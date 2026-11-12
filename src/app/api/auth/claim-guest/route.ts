import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clearGuestCookie, resolveAuthenticatedUser, resolveGuest } from "@/lib/polly/session";
import { tierFor } from "@/lib/polly/rewards";

export const dynamic = "force-dynamic";

// Claim-on-signup: merge a device guest's held rewards into the newly
// authenticated member.
//
// Flow:
//   1. Guest votes while anonymous → device-guest row accrues points in
//      `unclaimedPoints` (+ sweepstakes entries, rev share, pollsAnswered).
//   2. Guest signs up / signs in via Supabase Auth (SSO, phone OTP, or
//      magic link) → the client sends the JWT (Bearer header or Auth
//      session cookies) and the browser still carries the `polly_guest`
//      httpOnly cookie from step 1.
//   3. POST /api/auth/claim-guest merges the guest row into the member
//      row and marks the guest row claimed (`claimedAt`), so the same
//      guest balance can never be claimed twice. The guest cookie is
//      cleared on the response.
//
// Merge rules (single transaction):
//   - Balances add up: points += guest.points + guest.unclaimedPoints,
//     sweepstakesEntries, revShareCents, pollsAnswered, commentsPosted.
//     The member tier is recomputed from the new points total.
//   - Poll responses move to the member, EXCEPT polls the member already
//     answered — those stay on the guest row (one response per user per
//     poll is enforced by @@unique([pollId, userId]); the guest's
//     duplicate is left in place so published results don't change).
//   - Reward transactions move to the member.
//   - The guest row's balances are zeroed after the merge.
export async function POST(req: NextRequest) {
  const member = await resolveAuthenticatedUser(req);
  if (!member) {
    return NextResponse.json(
      { error: "Sign in to claim guest rewards" },
      { status: 401 },
    );
  }

  const guest = await resolveGuest(req);
  if (!guest) {
    return NextResponse.json(
      { error: "No guest session found on this device" },
      { status: 404 },
    );
  }
  if (guest.id === member.id) {
    return NextResponse.json({ error: "Guest rewards already claimed" }, { status: 409 });
  }
  if (guest.claimedAt) {
    return NextResponse.json({ error: "Guest rewards already claimed" }, { status: 409 });
  }
  if (guest.accountType !== "GUEST") {
    return NextResponse.json({ error: "Not a guest session" }, { status: 409 });
  }

  const claimedPoints = guest.points + guest.unclaimedPoints;
  const newPoints = member.points + claimedPoints;
  const newTier = tierFor(newPoints).key;

  const claimed = await db.$transaction(async (tx) => {
    // Move non-conflicting poll responses to the member.
    const memberPollIds = new Set(
      (await tx.pollResponse.findMany({ where: { userId: member.id }, select: { pollId: true } })).map(
        (r) => r.pollId,
      ),
    );
    const guestResponses = await tx.pollResponse.findMany({ where: { userId: guest.id } });
    for (const r of guestResponses) {
      if (!memberPollIds.has(r.pollId)) {
        await tx.pollResponse.update({ where: { id: r.id }, data: { userId: member.id } });
      }
    }

    await tx.rewardTransaction.updateMany({
      where: { userId: guest.id },
      data: { userId: member.id },
    });

    const updatedMember = await tx.user.update({
      where: { id: member.id },
      data: {
        points: newPoints,
        sweepstakesEntries: member.sweepstakesEntries + guest.sweepstakesEntries,
        revShareCents: member.revShareCents + guest.revShareCents,
        pollsAnswered: member.pollsAnswered + guest.pollsAnswered,
        commentsPosted: member.commentsPosted + guest.commentsPosted,
        tier: newTier,
      },
    });

    await tx.user.update({
      where: { id: guest.id },
      data: {
        points: 0,
        unclaimedPoints: 0,
        sweepstakesEntries: 0,
        revShareCents: 0,
        claimedAt: new Date(),
      },
    });

    return {
      claimedPoints,
      claimedSweepstakesEntries: guest.sweepstakesEntries,
      claimedRevShareCents: guest.revShareCents,
      claimedPollsAnswered: guest.pollsAnswered,
      memberPoints: updatedMember.points,
      memberTier: updatedMember.tier,
    };
  });

  const res = NextResponse.json({ claimed });
  clearGuestCookie(res);
  return res;
}
