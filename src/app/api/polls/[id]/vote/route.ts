import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveUser } from "@/lib/polly/session";
import { computeWeights, quotaCellFor, weightedResults } from "@/lib/polly/sampling";
import { awardForResponse } from "@/lib/polly/rewards";
import type { VoteResultDTO } from "@/lib/polly/types";

export const dynamic = "force-dynamic";

// Vote on a poll: records the response in its quota cell, re-runs
// post-stratification weighting across the full sample, awards
// tiered rewards, and returns weighted live results.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json()) as { optionId?: string; uid?: string };
  if (!body.optionId) return NextResponse.json({ error: "Pick an option" }, { status: 400 });

  const user = await resolveUser(body.uid ?? null);
  if (!user) return NextResponse.json({ error: "No session" }, { status: 401 });

  const poll = await db.poll.findUnique({
    where: { id },
    include: { options: { orderBy: { position: "asc" } } },
  });
  if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  if (poll.status !== "LIVE") return NextResponse.json({ error: "This poll is closed" }, { status: 409 });
  if (poll.closesAt.getTime() < Date.now())
    return NextResponse.json({ error: "This poll just closed" }, { status: 409 });

  const existing = await db.pollResponse.findUnique({
    where: { pollId_userId: { pollId: id, userId: user.id } },
  });
  if (existing) return NextResponse.json({ error: "You already weighed in" }, { status: 409 });

  const option = poll.options.find((o) => o.id === body.optionId);
  if (!option) return NextResponse.json({ error: "Invalid option" }, { status: 400 });

  const isGuest = user.accountType === "GUEST";
  const quotaCell = quotaCellFor(user);

  await db.pollResponse.create({
    data: {
      pollId: id,
      optionId: option.id,
      userId: user.id,
      quotaCell,
      weight: 1,
      rewardAwarded: 0,
    },
  });

  // Re-weight the whole sample (post-stratification).
  const allResponses = await db.pollResponse.findMany({ where: { pollId: id } });
  computeWeights(allResponses);
  const myResponse = allResponses.find((r) => r.userId === user.id);
  for (const r of allResponses) {
    await db.pollResponse.update({ where: { id: r.id }, data: { weight: r.weight } });
  }

  // Tiered rewards.
  const award = awardForResponse(user, poll, isGuest);
  await db.user.update({
    where: { id: user.id },
    data: {
      points: isGuest ? user.points : user.points + award.awardedPoints,
      unclaimedPoints: isGuest ? user.unclaimedPoints + award.awardedPoints : user.unclaimedPoints,
      sweepstakesEntries: user.sweepstakesEntries + award.sweepstakesEntries,
      revShareCents: user.revShareCents + award.revShareCents,
      pollsAnswered: { increment: 1 },
      tier: isGuest ? user.tier : award.tier.key,
    },
  });
  await db.pollResponse.update({
    where: { id: myResponse!.id },
    data: { rewardAwarded: award.awardedPoints },
  });
  await db.rewardTransaction.create({
    data: {
      userId: user.id,
      kind: "POINTS",
      amount: award.awardedPoints,
      memo: isGuest
        ? `Completed (unclaimed): ${poll.question.slice(0, 60)}`
        : `Completed: ${poll.question.slice(0, 60)}`,
      pollId: id,
    },
  });
  if (award.sweepstakesEntries > 0) {
    await db.rewardTransaction.create({
      data: {
        userId: user.id,
        kind: "SWEEPSTAKES",
        amount: award.sweepstakesEntries,
        memo: `${award.sweepstakesEntries}× entries — ${award.tier.label} tier bonus`,
        pollId: id,
      },
    });
  }
  if (award.revShareCents > 0) {
    await db.rewardTransaction.create({
      data: {
        userId: user.id,
        kind: "REV_SHARE",
        amount: award.revShareCents,
        memo: `${award.tier.revSharePct}% responder share — ${poll.question.slice(0, 40)}`,
        pollId: id,
      },
    });
  }

  const results = weightedResults(
    poll.options.map((o) => ({ id: o.id, label: o.label })),
    allResponses,
  );
  results.pollId = id;

  const dto: VoteResultDTO = {
    awardedPoints: award.awardedPoints,
    sweepstakesEntries: award.sweepstakesEntries,
    revShareCents: award.revShareCents,
    myWeight: myResponse!.weight,
    quotaCell,
    results,
    guestNotice: isGuest
      ? `${award.awardedPoints} points earned and held — create an account to claim them, plus sweepstakes entries and revenue share.`
      : null,
  };
  return NextResponse.json(dto);
}
