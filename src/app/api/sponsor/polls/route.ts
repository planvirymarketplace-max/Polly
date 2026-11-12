import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSupabaseAuthUser } from "@/lib/supabase/client";
import { resolveAuthenticatedUser } from "@/lib/polly/session";
import { computeWeights, MODE_META, weightedResults } from "@/lib/polly/sampling";
import type { PollResults } from "@/lib/polly/types";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  sponsorId: z.string().min(1),
  question: z.string().trim().min(8).max(200),
  context: z.string().trim().max(300).optional().default(""),
  topicId: z.string().min(1),
  samplingMode: z.enum(["QUOTA_UGC", "UGC_MATCH", "RANDOM", "SPONSOR_SEGMENT", "CREATOR"]),
  creatorId: z.string().optional(), // required when samplingMode = CREATOR
  targetMetros: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  rewardPoints: z.number().int().min(20).max(500).default(50),
  estimatedN: z.number().int().min(100).max(5000).default(500),
  // Options are trimmed and must be unique (case-insensitive) — a
  // poll with two identical options is a broken poll.
  options: z
    .array(z.string().trim().min(1).max(80))
    .min(2)
    .max(8)
    .refine((opts) => new Set(opts.map((o) => o.toLowerCase())).size === opts.length, {
      message: "Options must be unique",
    }),
  // Either a close date or a day count. closesAt must be in the future.
  closesInDays: z.number().int().min(1).max(60).default(7),
  closesAt: z
    .string()
    .datetime({ offset: true })
    .optional()
    .refine((s) => !s || new Date(s).getTime() > Date.now(), {
      message: "closesAt must be in the future",
    }),
  status: z.enum(["LIVE", "DRAFT"]).default("LIVE"),
  kind: z.enum(["SINGLE_CHOICE", "LIKERT"]).default("SINGLE_CHOICE"),
});

type SponsorPollRowDTO = {
  id: string;
  question: string;
  sponsor: string;
  sponsorKind: string;
  topic: { label: string; emoji: string | null } | null;
  samplingMode: string;
  modeLabel: string;
  creatorHandle: string | null; // CREATOR mode: handle of the channel delivering the poll
  status: string;
  estimatedN: number;
  actualN: number;
  rewardPoints: number;
  pricePerCompleteCents: number;
  spendCents: number;
  closesAt: string;
  createdAt: string;
  results: PollResults;
};

// Sponsor dashboard: list polls with weighted results + spend.
// Scoped to the caller's own sponsors — a sponsor only ever sees
// their own polls. ?sponsorId= filters further, but only when that
// sponsor belongs to the caller. 401 when unauthenticated.
export async function GET(req: NextRequest) {
  const identity = await getSupabaseAuthUser(req);
  if (!identity) {
    return NextResponse.json({ error: "Sign in to view sponsor polls" }, { status: 401 });
  }
  const mySponsors = await db.sponsor.findMany({
    where: { ownerSupabaseId: identity.supabaseId },
    select: { id: true },
  });
  const mySponsorIds = mySponsors.map((s) => s.id);

  const sponsorId = req.nextUrl.searchParams.get("sponsorId") ?? undefined;
  if (sponsorId && !mySponsorIds.includes(sponsorId)) {
    return NextResponse.json({ error: "Unknown sponsor" }, { status: 404 });
  }
  const polls = await db.poll.findMany({
    where: { sponsorId: sponsorId ? sponsorId : { in: mySponsorIds } },
    orderBy: { createdAt: "desc" },
    include: {
      sponsor: true,
      creator: { select: { handle: true, displayName: true } },
      topic: true,
      options: { orderBy: { position: "asc" } },
      responses: true,
    },
  });
  const rows: SponsorPollRowDTO[] = [];
  for (const p of polls) {
    const responses = p.responses.map((r) => ({ ...r }));
    computeWeights(responses);
    const results = weightedResults(
      p.options.map((o) => ({ id: o.id, label: o.label })),
      responses,
    );
    rows.push({
      id: p.id,
      question: p.question,
      sponsor: p.sponsor.name,
      sponsorKind: p.sponsor.kind,
      topic: p.topic ? { label: p.topic.label, emoji: p.topic.emoji } : null,
      samplingMode: p.samplingMode,
      modeLabel: MODE_META[p.samplingMode as keyof typeof MODE_META].label,
      creatorHandle: p.creator ? p.creator.handle : null,
      status: p.status,
      estimatedN: p.estimatedN,
      actualN: p.responses.length,
      rewardPoints: p.rewardPoints,
      pricePerCompleteCents: p.pricePerCompleteCents,
      spendCents: p.responses.length * p.pricePerCompleteCents,
      closesAt: p.closesAt.toISOString(),
      createdAt: p.createdAt.toISOString(),
      results,
    });
  }
  return NextResponse.json({ polls: rows });
}

// Launch a new sponsored poll — goes live in the member app instantly.
// Requires a Supabase JWT, and the named sponsor must be owned by the
// caller (Sponsor.ownerSupabaseId === JWT sub), else 403.
export async function POST(req: NextRequest) {
  const identity = await getSupabaseAuthUser(req);
  if (!identity) {
    return NextResponse.json({ error: "Sign in to launch a poll" }, { status: 401 });
  }
  const member = await resolveAuthenticatedUser(req);
  if (!member) {
    return NextResponse.json({ error: "Sign in to launch a poll" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") },
      { status: 400 }
    );
  }
  const d = parsed.data;

  const sponsor = await db.sponsor.findUnique({ where: { id: d.sponsorId } });
  if (!sponsor) return NextResponse.json({ error: "Unknown sponsor" }, { status: 404 });
  if (sponsor.ownerSupabaseId !== identity.supabaseId) {
    return NextResponse.json({ error: "This sponsor org is not yours" }, { status: 403 });
  }

  const topic = await db.topic.findUnique({ where: { id: d.topicId } });
  if (!topic) return NextResponse.json({ error: "Unknown topic" }, { status: 404 });

  // CREATOR mode: validate the channel and stamp it on the poll.
  let creatorId: string | null = null;
  if (d.samplingMode === "CREATOR") {
    if (!d.creatorId) {
      return NextResponse.json(
        { error: "Creator Audience mode requires a creator channel" },
        { status: 400 }
      );
    }
    const creator = await db.user.findUnique({ where: { id: d.creatorId } });
    if (!creator || !creator.isCreator) {
      return NextResponse.json({ error: "Unknown creator channel" }, { status: 404 });
    }
    creatorId = creator.id;
  }

  // Price is set server-side from the sampling mode's schedule —
  // the client never supplies pricePerCompleteCents.
  const perComplete = MODE_META[d.samplingMode].perCompleteCents;
  const poll = await db.poll.create({
    data: {
      sponsorId: d.sponsorId,
      question: d.question,
      context: d.context,
      topicId: d.topicId,
      kind: d.kind,
      samplingMode: d.samplingMode,
      creatorId,
      targetMetros: d.targetMetros.length > 0 ? JSON.stringify(d.targetMetros) : "NATIONAL",
      rewardPoints: d.rewardPoints,
      estimatedN: d.estimatedN,
      pricePerCompleteCents: perComplete,
      status: d.status,
      closesAt: d.closesAt
        ? new Date(d.closesAt)
        : new Date(Date.now() + d.closesInDays * 86400000),
    },
  });
  for (let i = 0; i < d.options.length; i++) {
    await db.pollOption.create({
      data: { pollId: poll.id, label: d.options[i], position: i },
    });
  }
  return NextResponse.json(
    { pollId: poll.id, perCompleteCents: perComplete, status: d.status },
    { status: 201 },
  );
}
