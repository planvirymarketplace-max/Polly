// Polly mobile API client.
//
// Base URL resolution (highest priority first):
//   1. EXPO_PUBLIC_API_URL env var (e.g. EXPO_PUBLIC_API_URL=https://api.polly.example npx expo start)
//   2. expo.extra.apiUrl from app.json (default http://localhost:3000)
//   3. http://localhost:3000 fallback
// See apps/mobile/README.md for localhost vs Lightsail pointing.
//
// Auth: the client sends the Supabase access token as
// `Authorization: Bearer <token>` on every request. There is no `uid`
// query param or body field anywhere in this file — identity comes from
// the JWT, which the backend resolves (its demo `uid` resolver is being
// replaced by the backend agent). A 401 clears the stored token and
// throws AuthRequiredError; callers must show a sign-in prompt, never
// silently fall back to a demo user.
//
// Endpoints mirror the real web API in src/app/api/* and the DTOs in
// src/lib/polly/types.ts. One exception: POST /api/session/claim-guest
// does NOT exist in the web API yet (verified 2026-11-12) — claimGuest()
// is implemented against that path so the UI can call it, and it will
// surface the backend's 404 honestly until the backend agent adds it.

import Constants from "expo-constants";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const extraUrl = (
  Constants.expoConfig?.extra as { apiUrl?: string } | undefined
)?.apiUrl?.trim();

export const API_BASE_URL = stripTrailingSlash(
  envUrl || extraUrl || "http://localhost:3000",
);

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

// ---------------------------------------------------------------------------
// DTOs — mirror src/lib/polly/types.ts (web). Keep in sync with the backend.
// ---------------------------------------------------------------------------

export type SamplingMode = "QUOTA_UGC" | "UGC_MATCH" | "RANDOM" | "SPONSOR_SEGMENT";
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
  quotaCell?: string;
  cellStatus?: "FILLING" | "BALANCED" | "FULL";
}

export interface PollOptionResult {
  id: string;
  label: string;
  rawCount: number;
  rawPct: number;
  weightedPct: number;
}

export interface QuotaFill {
  cell: string;
  target: number;
  sample: number;
  status: "FILLING" | "BALANCED" | "FULL";
}

export interface PollResults {
  pollId: string;
  n: number;
  weightedN: number;
  options: PollOptionResult[];
  quotaFill: QuotaFill[];
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

export interface SessionDTO {
  member: {
    id: string;
    handle: string;
    displayName: string;
    tier: string;
    metro: string | null;
  };
  guest: { id: string; handle: string; displayName: string };
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Thrown on HTTP 401. The token has been cleared by then. Never retry as a demo user. */
export class AuthRequiredError extends ApiError {
  constructor(message = "Sign in required") {
    super(message, 401);
    this.name = "AuthRequiredError";
  }
}

export function isAuthRequiredError(e: unknown): e is AuthRequiredError {
  return e instanceof AuthRequiredError;
}

// ---------------------------------------------------------------------------
// Token storage (in-memory; the AuthProvider owns persistence via Supabase)
// ---------------------------------------------------------------------------

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token || null;
}

export function clearAuthToken(): void {
  authToken = null;
}

export function getAuthToken(): string | null {
  return authToken;
}

export function hasAuthToken(): boolean {
  return authToken !== null;
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch (e) {
    throw new ApiError(
      `Could not reach the Polly API at ${API_BASE_URL}. Check the API URL and that the web app is running. (${e instanceof Error ? e.message : "network error"})`,
      0,
    );
  }

  const text = await res.text();
  let json: { error?: string } | null = null;
  if (text) {
    try {
      json = JSON.parse(text) as { error?: string };
    } catch {
      json = null;
    }
  }

  if (res.status === 401) {
    clearAuthToken();
    throw new AuthRequiredError(
      (json && json.error) || "Your session expired — please sign in again.",
    );
  }
  if (!res.ok) {
    throw new ApiError(
      (json && json.error) || `Request failed: ${res.status} ${path}`,
      res.status,
    );
  }
  return (json ?? {}) as T;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const api = {
  /** GET /api/session — current member + guest identities (JWT-resolved server-side). */
  session: () => request<SessionDTO>("/api/session"),

  /** Alias for session(): the signed-in member. */
  me: async () => (await request<SessionDTO>("/api/session")).member,

  /** GET /api/happenings — the Commons feed (public; no auth required). */
  happenings: () => request<{ happenings: HappeningDTO[] }>("/api/happenings"),

  /** POST /api/happenings/:id/comments — post a take (auth required). */
  postComment: (happeningId: string, body: string) =>
    request<{ comment: HappeningCommentDTO; interestNudge: string | null }>(
      `/api/happenings/${encodeURIComponent(happeningId)}/comments`,
      { method: "POST", body: JSON.stringify({ body }) },
    ),

  /** GET /api/polls — live + closed polls for the signed-in user (auth required). */
  polls: () => request<{ live: PollCardDTO[]; closed: PollCardDTO[] }>("/api/polls"),

  /** POST /api/polls/:id/vote — vote once; server rejects a second vote (409). */
  vote: (pollId: string, optionId: string) =>
    request<VoteResultDTO>(`/api/polls/${encodeURIComponent(pollId)}/vote`, {
      method: "POST",
      body: JSON.stringify({ optionId }),
    }),

  /** GET /api/polls/:id/results — raw vs census-weighted results. */
  results: (pollId: string) =>
    request<{ results: PollResults }>(
      `/api/polls/${encodeURIComponent(pollId)}/results`,
    ),

  /** GET /api/wallet — points, held points, entries, rev share, tier (auth required). */
  wallet: () => request<WalletDTO>("/api/wallet"),

  /** GET /api/profile — profile + interest graph (auth required). */
  profile: () => request<ProfileDTO>("/api/profile"),

  /**
   * POST /api/session/claim-guest — move held (unclaimed) guest points onto
   * the new member account. NOTE: this endpoint does not exist in the web
   * API yet; until the backend adds it this call returns the backend's
   * 404, which callers must show honestly.
   */
  claimGuest: () =>
    request<{ claimedPoints: number; points: number; unclaimedPoints: number }>(
      "/api/session/claim-guest",
      { method: "POST", body: JSON.stringify({}) },
    ),
};
