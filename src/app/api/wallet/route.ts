import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveUser } from "@/lib/polly/session";
import { nextTierFor, tierFor } from "@/lib/polly/rewards";
import type { WalletDTO } from "@/lib/polly/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  const user = await resolveUser(uid);
  if (!user) return NextResponse.json({ error: "No session" }, { status: 401 });

  const txs = await db.rewardTransaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const tier = tierFor(user.points);
  const next = nextTierFor(user.points);

  const dto: WalletDTO = {
    points: user.points,
    unclaimedPoints: user.unclaimedPoints,
    sweepstakesEntries: user.sweepstakesEntries,
    revShareCents: user.revShareCents,
    tier: tier.key,
    tierProgress: {
      current: user.points,
      next: next ? next.minPoints : null,
      label: next ? next.label : "Max tier reached",
    },
    accountType: user.accountType as "MEMBER" | "GUEST",
    transactions: txs.map((t) => ({
      id: t.id,
      kind: t.kind,
      amount: t.amount,
      memo: t.memo,
      createdAt: t.createdAt.toISOString(),
    })),
  };
  return NextResponse.json(dto);
}
