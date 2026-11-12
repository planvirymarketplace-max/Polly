// ─────────────────────────────────────────────────────────────
// POLLY CORE — types shared by app + API.
// In the monorepo this file becomes packages/core/src/types.ts
// and is imported by both apps/web (Next.js) and apps/mobile (Expo).
// ─────────────────────────────────────────────────────────────

export type SamplingMode =
  | "QUOTA_UGC"
  | "UGC_MATCH"
  | "RANDOM"
  | "SPONSOR_SEGMENT"
  | "CREATOR";

export type Tier = "HATCHLING" | "VOICED" | "WEATHERED" | "FLOCK_LEADER";

export type AccountType = "MEMBER" | "GUEST";

export interface TopicDTO {
  slug: string;
  label: string;
  emoji: string | null;
}

export interface SelectionExplanation {
  mode: SamplingMode;
  headline: string;
  reasons: string[];
  // QUOTA_UGC only: the demographic cell this user occupies
  quotaCell?: string;
  // QUOTA_UGC only: whether the user's cell is currently under-filled
  cellStatus?: "FILLING" | "BALANCED" | "FULL";
}

export interface PollOptionResult {
  id: string;
  label: string;
  rawCount: number;
  rawPct: number;
  weightedPct: number;
}

export interface PollResults {
  pollId: string;
  n: number;
  weightedN: number;
  options: PollOptionResult[];
  quotaFill: QuotaFill[];
}

export interface QuotaFill {
  cell: string;
  target: number; // census-aligned share, 0-1
  sample: number; // share of sample so far, 0-1
  status: "FILLING" | "BALANCED" | "FULL";
}

export interface PollCardDTO {
  id: string;
  question: string;
  context: string | null;
  kind: string;
  samplingMode: SamplingMode;
  rewardPoints: number;
  status: string;
  closesAt: string;
  estimatedN: number;
  sponsor: { name: string; kind: string };
  // CREATOR mode: the channel the poll was delivered through
  creator: { handle: string; displayName: string } | null;
  topic: TopicDTO | null;
  options: { id: string; label: string }[];
  alreadyResponded: boolean;
  myOptionId?: string;
  explanation: SelectionExplanation | null;
}

export interface HappeningCommentDTO {
  id: string;
  body: string;
  likes: number;
  createdAt: string;
  author: { handle: string; displayName: string; tier: string };
}

export interface HappeningDTO {
  id: string;
  title: string;
  summary: string;
  sourceName: string;
  /** Canonical article URL (decoded from the stored `Source:` prefix — see rss.ts). Null for rows without one. */
  sourceUrl: string | null;
  metro: string | null;
  stateCode: string | null;
  hotness: number;
  commentCount: number;
  createdAt: string;
  topic: TopicDTO | null;
  comments: HappeningCommentDTO[];
}

export interface WalletDTO {
  points: number;
  unclaimedPoints: number;
  sweepstakesEntries: number;
  revShareCents: number;
  tier: Tier;
  tierProgress: { current: number; next: number | null; label: string };
  accountType: AccountType;
  transactions: {
    id: string;
    kind: string;
    amount: number;
    memo: string;
    createdAt: string;
  }[];
}

export interface InterestDTO {
  topic: TopicDTO;
  affinity: number;
}

export interface ProfileDTO {
  handle: string;
  displayName: string;
  accountType: AccountType;
  metro: string | null;
  stateCode: string | null;
  ageBracket: string | null;
  genderBucket: string | null;
  tier: Tier;
  followerCount: number;
  pollsAnswered: number;
  commentsPosted: number;
  interests: InterestDTO[];
}

export interface VoteResultDTO {
  awardedPoints: number;
  sweepstakesEntries: number;
  revShareCents: number;
  myWeight: number;
  quotaCell: string | null;
  results: PollResults;
  guestNotice: string | null;
}

export interface PriceEstimateDTO {
  completes: number;
  perCompleteCents: number;
  totalCents: number;
  traditionalLowCents: number;
  traditionalHighCents: number;
  fieldDays: number;
  traditionalFieldDays: number;
}
