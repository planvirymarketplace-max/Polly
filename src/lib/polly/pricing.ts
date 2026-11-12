// ─────────────────────────────────────────────────────────────
// POLLY CORE — Sponsor pricing estimator.
// The thesis: drive down the cost of knowing what people think.
// Demo figures for the estimator; production plugs in real
// per-complete costs from the Supabase billing tables.
// ─────────────────────────────────────────────────────────────

import type { PriceEstimateDTO, SamplingMode } from "./types";
import { MODE_META } from "./sampling";

export function estimate(
  completes: number,
  mode: SamplingMode,
  metros: string[]
): PriceEstimateDTO {
  const perCompleteCents = MODE_META[mode].perCompleteCents;
  const totalCents = perCompleteCents * completes;
  // Traditional live-caller benchmark: ~$25-$50 per complete (demo basis)
  const traditionalLowCents = completes * 2500;
  const traditionalHighCents = completes * 5000;
  const fieldDays = mode === "RANDOM" ? 3 : metros.length > 3 ? 2 : 1;
  const traditionalFieldDays = 7;
  return {
    completes,
    perCompleteCents,
    totalCents,
    traditionalLowCents,
    traditionalHighCents,
    fieldDays,
    traditionalFieldDays,
  };
}
