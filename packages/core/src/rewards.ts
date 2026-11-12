// ─────────────────────────────────────────────────────────────
// POLLY CORE — Tiered rewards engine.
// Users earn from everyday engagement:
//   points        per poll, multiplied by tier
//   sweepstakes   entries into local/national drawings
//   rev share     % of sponsor spend flows back to responders
//   perks         badges, early results, priority invites
// ─────────────────────────────────────────────────────────────

import type { Tier } from "./types";

export interface TierDef {
  key: Tier;
  label: string;
  minPoints: number;
  pointsMultiplier: number;
  sweepstakesPerPoll: number;
  revSharePct: number; // share of sponsor per-complete price returned to responders
  perks: string[];
  emoji: string;
}

export const TIERS: TierDef[] = [
  {
    key: "HATCHLING",
    label: "Hatchling",
    minPoints: 0,
    pointsMultiplier: 1,
    sweepstakesPerPoll: 1,
    revSharePct: 0,
    perks: ["Vote on sponsored polls", "Sweepstakes entries", "See results after voting"],
    emoji: "🐣",
  },
  {
    key: "VOICED",
    label: "Voiced",
    minPoints: 500,
    pointsMultiplier: 1.25,
    sweepstakesPerPoll: 2,
    revSharePct: 1,
    perks: [
      "1.25× points on every poll",
      "2× sweepstakes entries",
      "1% revenue share on polls you complete",
      "Profile badge: Voiced",
    ],
    emoji: "🗣️",
  },
  {
    key: "WEATHERED",
    label: "Weathered",
    minPoints: 2500,
    pointsMultiplier: 1.5,
    sweepstakesPerPoll: 3,
    revSharePct: 2,
    perks: [
      "1.5× points on every poll",
      "3× sweepstakes entries",
      "2% revenue share",
      "Early access to results before they publish",
      "Priority invites for high-value polls",
    ],
    emoji: "🦜",
  },
  {
    key: "FLOCK_LEADER",
    label: "Flock Leader",
    minPoints: 10000,
    pointsMultiplier: 2,
    sweepstakesPerPoll: 5,
    revSharePct: 5,
    perks: [
      "2× points on every poll",
      "5× sweepstakes entries",
      "5% revenue share",
      "Thought-leader badge sponsors can see",
      "First look at national polls",
      "Annual flock gift box",
    ],
    emoji: "👑",
  },
];

export function tierFor(points: number): TierDef {
  let t = TIERS[0];
  for (const tier of TIERS) if (points >= tier.minPoints) t = tier;
  return t;
}

export function nextTierFor(points: number): TierDef | null {
  return TIERS.find((t) => t.minPoints > points) ?? null;
}

export interface AwardResult {
  awardedPoints: number;
  sweepstakesEntries: number;
  revShareCents: number;
  tier: TierDef;
}

/**
 * What a user earns for completing a poll.
 * Guests accrue unclaimed points — claimable the moment they
 * create an account. Rev share and sweepstakes are member-only.
 */
export function awardForResponse(
  user: { points: number; unclaimedPoints: number; accountType: string },
  poll: { rewardPoints: number; pricePerCompleteCents: number },
  isGuest: boolean
): AwardResult {
  const tier = tierFor(user.points);
  const base = poll.rewardPoints;
  const awardedPoints = Math.round(base * tier.pointsMultiplier);
  const sweepstakesEntries = isGuest ? 0 : tier.sweepstakesPerPoll;
  const revShareCents = isGuest
    ? 0
    : Math.round((poll.pricePerCompleteCents * tier.revSharePct) / 100);
  return { awardedPoints, sweepstakesEntries, revShareCents, tier };
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
