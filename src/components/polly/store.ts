"use client";

// Polly client state: which view, which acting identity, app vs sponsor mode.
// Zustand keeps the phone app and sponsor dashboard coherent in one route.

import { create } from "zustand";
import type { VoteResultDTO } from "@/lib/polly/types";

export type AppView = "feed" | "polls" | "rewards" | "profile";

interface PollyState {
  userId: string | null;
  tier: string;
  isGuest: boolean;
  view: AppView;
  mode: "auth" | "app" | "sponsor";
  splashes: Record<string, VoteResultDTO>;
  setSession: (userId: string, tier: string, isGuest: boolean) => void;
  setView: (v: AppView) => void;
  setMode: (m: "auth" | "app" | "sponsor") => void;
  setTier: (t: string) => void;
  setSplash: (pollId: string, v: VoteResultDTO) => void;
  signOut: () => void;
}

export const usePolly = create<PollyState>((set) => ({
  userId: null,
  tier: "HATCHLING",
  isGuest: false,
  view: "feed",
  mode: "auth",
  splashes: {},
  setSession: (userId, tier, isGuest) =>
    set({ userId, tier, isGuest, mode: "app", view: "feed", splashes: {} }),
  setView: (view) => set({ view }),
  setMode: (mode) => set({ mode }),
  setTier: (tier) => set({ tier }),
  setSplash: (pollId, v) =>
    set((s) => ({ splashes: { ...s.splashes, [pollId]: v } })),
  signOut: () =>
    set({ userId: null, tier: "HATCHLING", isGuest: false, mode: "auth", view: "feed", splashes: {} }),
}));
