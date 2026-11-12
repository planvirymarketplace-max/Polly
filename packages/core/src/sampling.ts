// ─────────────────────────────────────────────────────────────
// POLLY CORE — Sampling engine.
// The business. Four selection modes:
//   QUOTA_UGC      invite by UGC interest, cap by demographic
//                  quota cells, weight results to census targets
//   UGC_MATCH      pure topical matching against the interest graph
//   RANDOM         uniform draw from opted-in users
//   SPONSOR_SEGMENT sponsor-chosen geography × topic × demo segment
// Produces transparent "why you?" explanations — Polly never
// selects in the dark.
// ─────────────────────────────────────────────────────────────

import type { SamplingMode, SelectionExplanation, QuotaFill, PollResults } from "./types";

// Demo census-aligned targets (national, adult 18+).
// Production: per-metro targets from ACS/Census tables in Supabase.
export const AGE_TARGETS: Record<string, number> = {
  "18-24": 0.12,
  "25-34": 0.18,
  "35-44": 0.16,
  "45-54": 0.17,
  "55-64": 0.15,
  "65+": 0.22,
};

export const GENDER_TARGETS: Record<string, number> = {
  F: 0.51,
  M: 0.47,
  NB: 0.01,
  O: 0.01,
};

export const MODE_META: Record<
  SamplingMode,
  { label: string; blurb: string; perCompleteCents: number }
> = {
  QUOTA_UGC: {
    label: "Quota + UGC",
    blurb: "Invited by what you engage with, balanced to census quotas, weighted to be publishable.",
    perCompleteCents: 150,
  },
  UGC_MATCH: {
    label: "UGC Match",
    blurb: "Pure topical match — the people already talking about it. Fast, passionate, skews loud.",
    perCompleteCents: 100,
  },
  RANDOM: {
    label: "Random Draw",
    blurb: "Uniform draw from opted-in users in the geography. Cleanest defensibility, no targeting.",
    perCompleteCents: 120,
  },
  SPONSOR_SEGMENT: {
    label: "Sponsor Segment",
    blurb: "You define the slice: metros, topics, demographics. Polly fills the order.",
    perCompleteCents: 225,
  },
};

export function quotaCellFor(user: {
  ageBracket: string | null;
  genderBucket: string | null;
  metro: string | null;
}): string {
  return `${user.ageBracket ?? "unk"}|${user.genderBucket ?? "unk"}|${user.metro ?? "natl"}`;
}

interface InterestLike {
  affinity: number;
  topic: { slug: string; label: string; emoji: string | null };
}

/**
 * Human-readable explanation of why the system surfaced a poll
 * to a specific user. This is the transparency layer — non-invasive
 * means you always know why you were picked.
 */
export function explainSelection(
  user: {
    metro: string | null;
    stateCode: string | null;
    ageBracket: string | null;
    genderBucket: string | null;
    interests: InterestLike[];
  },
  poll: {
    samplingMode: SamplingMode;
    targetMetros: string;
    topic: { slug: string; label: string; emoji: string | null } | null;
  }
): SelectionExplanation {
  const metros: string[] =
    poll.targetMetros === "NATIONAL" ? [] : JSON.parse(poll.targetMetros);
  const geoMatch = metros.length === 0 || (user.metro ? metros.includes(user.metro) : false);
  const topInterest = [...user.interests].sort((a, b) => b.affinity - a.affinity)[0];
  const pollInterest = poll.topic
    ? user.interests.find((i) => i.topic.slug === poll.topic!.slug)
    : undefined;
  const matchedTopic = pollInterest ?? topInterest;
  const cell = quotaCellFor(user);

  switch (poll.samplingMode) {
    case "QUOTA_UGC": {
      const reasons: string[] = [];
      if (matchedTopic && pollInterest) {
        reasons.push(
          `You engage with ${poll.topic?.label} in your feed — that's the invite.`
        );
      } else if (matchedTopic) {
        reasons.push(`Your activity centers on ${matchedTopic.topic.label}.`);
      }
      if (user.ageBracket && user.genderBucket) {
        reasons.push(
          `Your cell (${user.ageBracket}, ${user.genderBucket}, ${
            user.metro ?? "national"
          }) is being filled toward census share.`
        );
      } else {
        reasons.push(
          "Guest: no demographics on file yet — your cell fills as unknown until you create an account."
        );
      }
      if (geoMatch && metros.length > 0) reasons.push(`You're inside the target geography.`);
      return {
        mode: "QUOTA_UGC",
        headline: "Selected for you — by interest, balanced by quota",
        reasons,
        quotaCell: cell,
        cellStatus: "FILLING",
      };
    }
    case "UGC_MATCH": {
      const reasons: string[] = [];
      if (pollInterest && matchedTopic) {
        reasons.push(
          `Strong signal: you comment and vote on ${poll.topic?.label} more than most.`
        );
      } else if (topInterest) {
        reasons.push(`Top interest match: ${topInterest.topic.label}.`);
      }
      if (geoMatch && metros.length > 0) reasons.push(`You're inside the target geography.`);
      return {
        mode: "UGC_MATCH",
        headline: "Matched to your engagement — no quotas applied",
        reasons,
      };
    }
    case "RANDOM": {
      return {
        mode: "RANDOM",
        headline: "Random draw — everyone had equal odds",
        reasons: [
          metros.length > 0 && user.metro
            ? `Drawn from opted-in users in ${metros.join(", ")}.`
            : "Drawn from all opted-in users, equal probability.",
          "No targeting was used for this poll.",
        ],
      };
    }
    case "SPONSOR_SEGMENT": {
      const seg: string[] = [];
      if (metros.length > 0 && user.metro) seg.push(`geography: ${metros.join(", ")}`);
      if (poll.topic) seg.push(`topic: ${poll.topic.label}`);
      if (user.ageBracket) seg.push(`age: ${user.ageBracket}`);
      return {
        mode: "SPONSOR_SEGMENT",
        headline: "You fit the segment the sponsor is buying",
        reasons: [
          seg.length > 0
            ? `Sponsor segment — ${seg.join(" · ")}.`
            : "Sponsor-defined segment.",
          "Sponsors choose who they hear from; Polly verifies the fill.",
        ],
      };
    }
  }
}

interface ResponseLike {
  weight: number;
  quotaCell: string | null;
  optionId: string;
  user?: { ageBracket: string | null; genderBucket: string | null; metro: string | null };
}

/**
 * Post-stratification weighting: each demographic cell gets
 * weight = census_target_share / sample_share. This is what makes
 * UGC-recruited samples publishable — the sellable difference
 * between Polly and a Twitter poll.
 */
export function computeWeights(responses: ResponseLike[]): void {
  const byCell = new Map<string, number>();
  for (const r of responses) {
    const cell = r.quotaCell ?? "unk|unk|natl";
    byCell.set(cell, (byCell.get(cell) ?? 0) + 1);
  }
  const total = responses.length || 1;
  for (const r of responses) {
    const cell = r.quotaCell ?? "unk|unk|natl";
    const sampleShare = (byCell.get(cell) ?? 1) / total;
    const [age, gender] = cell.split("|");
    const target = (AGE_TARGETS[age] ?? 0.1) * (GENDER_TARGETS[gender] ?? 0.3);
    // RIM-style cap: no single response outweighs the room
    r.weight = Math.min(4, Math.max(0.25, target / Math.max(sampleShare, 0.01)));
  }
}

export function quotaFillFor(responses: ResponseLike[]): QuotaFill[] {
  const byAge = new Map<string, number>();
  for (const r of responses) {
    const age = r.quotaCell?.split("|")[0] ?? "unk";
    byAge.set(age, (byAge.get(age) ?? 0) + 1);
  }
  const total = responses.length || 1;
  return Object.entries(AGE_TARGETS).map(([age, target]) => {
    const sample = (byAge.get(age) ?? 0) / total;
    const ratio = sample / target;
    return {
      cell: age,
      target,
      sample,
      status: ratio < 0.6 ? "FILLING" : ratio > 1.15 ? "FULL" : "BALANCED",
    } as QuotaFill;
  });
}

export function weightedResults(
  options: { id: string; label: string }[],
  responses: ResponseLike[]
): PollResults {
  const n = responses.length;
  const totalWeight = responses.reduce((s, r) => s + r.weight, 0) || 1;
  return {
    pollId: "",
    n,
    weightedN: Math.round(totalWeight * 10) / 10,
    options: options.map((o) => {
      const rs = responses.filter((r) => r.optionId === o.id);
      const rawCount = rs.length;
      const rawPct = n === 0 ? 0 : Math.round((rawCount / n) * 1000) / 10;
      const w = rs.reduce((s, r) => s + r.weight, 0);
      const weightedPct = Math.round((w / totalWeight) * 1000) / 10;
      return { id: o.id, label: o.label, rawCount, rawPct, weightedPct };
    }),
    quotaFill: quotaFillFor(responses),
  };
}
