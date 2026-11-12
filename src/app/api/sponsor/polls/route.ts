import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { computeWeights, MODE_META, weightedResults } from "@/lib/polly/sampling";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  sponsorId: z.string().min(1),
  question: z.string().min(8).max(200),
  context: z.string().max(300).optional().default(""),
  topicId: z.string().min(1),
  samplingMode: z.enum(["QUOTA_UGC", "UGC_MATCH", "RANDOM", "SPONSOR_SEGMENT"]),
  targetMetros: z.array(z.string()).default([]),
  rewardPoints: z.number().int().min(20).max(500).default(50),
  estimatedN: z.number().int().min(100).max(5000).default(500),
  options: z.array(z.string().min(1).max(80)).min(2).max(8),
  closesInDays: z.number().int().min(1).max(60).default(7),
});

// Sponsor dashboard: list polls with weighted results + spend.
export async function GET() {
  const polls = await db.poll.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      sponsor: true,
      topic: true,
      options: { orderBy: { position: "asc" } },
      responses: true,
    },
  });
  const rows = [];
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
export async function POST(req: NextRequest) {
  const json = await req.json();
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

  const perComplete = MODE_META[d.samplingMode].perCompleteCents;
  const poll = await db.poll.create({
    data: {
      sponsorId: d.sponsorId,
      question: d.question,
      context: d.context,
      topicId: d.topicId,
      samplingMode: d.samplingMode,
      targetMetros: d.targetMetros.length > 0 ? JSON.stringify(d.targetMetros) : "NATIONAL",
      rewardPoints: d.rewardPoints,
      estimatedN: d.estimatedN,
      pricePerCompleteCents: perComplete,
      status: "LIVE",
      closesAt: new Date(Date.now() + d.closesInDays * 86400000),
    },
  });
  for (let i = 0; i < d.options.length; i++) {
    await db.pollOption.create({
      data: { pollId: poll.id, label: d.options[i], position: i },
    });
  }
  return NextResponse.json({ pollId: poll.id, perCompleteCents: perComplete });
}
