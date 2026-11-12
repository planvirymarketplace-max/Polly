import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSupabaseAuthUser } from "@/lib/supabase/client";
import { resolveAuthenticatedUser } from "@/lib/polly/session";
import { topicDTO } from "@/lib/polly/session";
import { decodeSourceUrl, encodeSourceUrl } from "@/lib/polly/rss";
import type { HappeningDTO } from "@/lib/polly/types";

export const dynamic = "force-dynamic";

// The Commons — feed of local + national geo-political happenings.
// Rows come from real RSS ingestion (scripts/ingest-rss.ts) or from
// sponsor/admin creation below. An empty DB returns an empty list:
// Polly never invents fallback headlines.

function toDTO(h: {
  id: string;
  title: string;
  summary: string;
  sourceName: string;
  metro: string | null;
  stateCode: string | null;
  hotness: number;
  commentCount: number;
  createdAt: Date;
  topic: { slug: string; label: string; emoji: string | null } | null;
  comments: {
    id: string;
    body: string;
    likes: number;
    createdAt: Date;
    user: { handle: string; displayName: string; tier: string };
  }[];
}): HappeningDTO {
  const { summary, sourceUrl } = decodeSourceUrl(h.summary);
  return {
    id: h.id,
    title: h.title,
    summary,
    sourceName: h.sourceName,
    sourceUrl,
    metro: h.metro,
    stateCode: h.stateCode,
    hotness: h.hotness,
    commentCount: h.commentCount,
    createdAt: h.createdAt.toISOString(),
    topic: topicDTO(h.topic),
    comments: h.comments.map((c) => ({
      id: c.id,
      body: c.body,
      likes: c.likes,
      createdAt: c.createdAt.toISOString(),
      author: {
        handle: c.user.handle,
        displayName: c.user.displayName,
        tier: c.user.tier,
      },
    })),
  };
}

export async function GET() {
  const happenings = await db.happening.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      topic: true,
      comments: {
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { user: true },
      },
    },
  });

  return NextResponse.json({ happenings: happenings.map(toDTO) });
}

const createHappeningSchema = z.object({
  title: z.string().trim().min(8).max(200),
  summary: z.string().trim().min(1).max(2000),
  // Attribution is mandatory: every happening must name its real
  // source and link to it. No anonymous / unattributed items.
  sourceName: z.string().trim().min(1).max(120),
  sourceUrl: z.string().trim().url().max(500),
  metro: z.string().trim().min(1).max(80).nullable().optional(),
  stateCode: z
    .string()
    .trim()
    .min(2)
    .max(2)
    .nullable()
    .optional()
    .transform((s) => (s ? s.toUpperCase() : s)),
  topicId: z.string().min(1),
});

// Sponsor/admin happening creation. Polls are sponsor-only and the
// feed is user-driven, but the happenings themselves come from real
// sources: this endpoint is for sponsors/admins adding a sourced
// item by hand (e.g. a council agenda item). Community users have
// no happening-creation endpoint — they comment, they don't publish.
// Requires a Supabase JWT and at least one sponsor org owned by the
// caller (Sponsor.ownerSupabaseId === JWT sub).
export async function POST(req: NextRequest) {
  const identity = await getSupabaseAuthUser(req);
  if (!identity) {
    return NextResponse.json({ error: "Sign in to add a happening" }, { status: 401 });
  }
  const member = await resolveAuthenticatedUser(req);
  if (!member) {
    return NextResponse.json({ error: "Sign in to add a happening" }, { status: 401 });
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = createHappeningSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const sponsor = await db.sponsor.findFirst({
    where: { ownerSupabaseId: identity.supabaseId },
  });
  if (!sponsor) {
    return NextResponse.json(
      { error: "Register a sponsor org first" },
      { status: 403 },
    );
  }

  const topic = await db.topic.findUnique({ where: { id: d.topicId } });
  if (!topic) return NextResponse.json({ error: "Unknown topic" }, { status: 404 });

  const created = await db.happening.create({
    data: {
      title: d.title,
      summary: encodeSourceUrl(d.summary, d.sourceUrl),
      sourceName: d.sourceName,
      metro: d.metro ?? null,
      stateCode: d.stateCode ?? null,
      topicId: d.topicId,
    },
    include: { topic: true, comments: { include: { user: true } } },
  });

  return NextResponse.json(
    { happening: toDTO({ ...created, comments: [] }) },
    { status: 201 },
  );
}
