"use client";

// Data hooks — TanStack Query against the API layer.
// Identity is never sent as a query param or body field: every
// request carries `Authorization: Bearer <Supabase JWT>` via authFetch
// when a session exists, and the device-guest httpOnly cookie travels
// automatically on same-origin requests. The `userId` argument is kept
// only as part of the query key (per-user caching); it is never sent.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  HappeningDTO,
  PollCardDTO,
  PollResults,
  ProfileDTO,
  VoteResultDTO,
  WalletDTO,
} from "@/lib/polly/types";
import { authFetch } from "@/lib/supabase/browser";

export interface SponsorPollRow {
  id: string;
  question: string;
  sponsor: string;
  sponsorKind: string;
  topic: { label: string; emoji: string | null } | null;
  samplingMode: string;
  modeLabel: string;
  creatorHandle: string | null;
  status: string;
  estimatedN: number;
  actualN: number;
  rewardPoints: number;
  pricePerCompleteCents: number;
  spendCents: number;
  closesAt: string;
  createdAt: string;
  results: PollResults;
}

export function useHappenings() {
  return useQuery<{ happenings: HappeningDTO[] }>({
    queryKey: ["happenings"],
    queryFn: async () => {
      const res = await authFetch("/api/happenings");
      if (!res.ok) throw new Error("Feed failed to load");
      return res.json();
    },
  });
}

export function useComment(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      happeningId,
      body,
    }: {
      happeningId: string;
      body: string;
    }) => {
      const res = await authFetch(`/api/happenings/${happeningId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not post");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["happenings"] });
      qc.invalidateQueries({ queryKey: ["profile", userId] });
    },
  });
}

export function usePolls(userId: string | null) {
  return useQuery<{ live: PollCardDTO[]; closed: PollCardDTO[] }>({
    queryKey: ["polls", userId],
    queryFn: async () => {
      const res = await authFetch("/api/polls");
      if (!res.ok) throw new Error("Polls failed to load");
      return res.json();
    },
  });
}

export function useVote(userId: string | null) {
  const qc = useQueryClient();
  return useMutation<VoteResultDTO, Error, { pollId: string; optionId: string }>({
    mutationFn: async ({ pollId, optionId }) => {
      const res = await authFetch(`/api/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Vote failed");
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["polls", userId] });
      qc.invalidateQueries({ queryKey: ["wallet", userId] });
      qc.invalidateQueries({ queryKey: ["profile", userId] });
      qc.invalidateQueries({ queryKey: ["pollResults", vars.pollId] });
      qc.invalidateQueries({ queryKey: ["sponsorPolls"] });
    },
  });
}

export function usePollResults(pollId: string | null) {
  return useQuery<{ results: PollResults }>({
    queryKey: ["pollResults", pollId],
    enabled: Boolean(pollId),
    queryFn: async () => {
      const res = await authFetch(`/api/polls/${pollId}/results`);
      if (!res.ok) throw new Error("Results failed to load");
      return res.json();
    },
  });
}

export function useWallet(userId: string | null) {
  return useQuery<WalletDTO>({
    queryKey: ["wallet", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const res = await authFetch("/api/wallet");
      if (!res.ok) throw new Error("Wallet failed to load");
      return res.json();
    },
  });
}

export function useProfile(userId: string | null) {
  return useQuery<ProfileDTO>({
    queryKey: ["profile", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const res = await authFetch("/api/profile");
      if (!res.ok) throw new Error("Profile failed to load");
      return res.json();
    },
  });
}

export function useSponsorPolls() {
  return useQuery<{ polls: SponsorPollRow[] }>({
    queryKey: ["sponsorPolls"],
    queryFn: async () => {
      const res = await authFetch("/api/sponsor/polls");
      if (!res.ok) throw new Error("Sponsor polls failed to load");
      return res.json();
    },
  });
}

export function useCreateSponsorPoll() {
  const qc = useQueryClient();
  return useMutation<{ pollId: string; perCompleteCents: number }, Error, Record<string, unknown>>({
    mutationFn: async (payload) => {
      const res = await authFetch("/api/sponsor/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Create failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sponsorPolls"] });
      qc.invalidateQueries({ queryKey: ["polls"] });
    },
  });
}

export function useEstimate(params: {
  completes: number;
  mode: string;
  metros: string;
  enabled: boolean;
}) {
  const search = new URLSearchParams({
    completes: String(params.completes),
    mode: params.mode,
    metros: params.metros,
  });
  return useQuery({
    queryKey: ["estimate", params.completes, params.mode, params.metros],
    enabled: params.enabled,
    queryFn: async () => {
      const res = await authFetch(`/api/sponsor/estimate?${search.toString()}`);
      if (!res.ok) throw new Error("Estimate failed");
      return res.json();
    },
  });
}
