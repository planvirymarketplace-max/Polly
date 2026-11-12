import { NextRequest, NextResponse } from "next/server";
import { estimate } from "@/lib/polly/pricing";
import type { SamplingMode } from "@/lib/polly/types";

export const dynamic = "force-dynamic";

const MODES: SamplingMode[] = ["QUOTA_UGC", "UGC_MATCH", "RANDOM", "SPONSOR_SEGMENT"];

// Live price estimate while a sponsor composes a poll —
// the "drive down polling cost" thesis, in numbers.
// Wired 1:1 to packages/core/src/pricing.ts via src/lib/polly/pricing.ts
// (verified byte-identical); this route only validates inputs and
// never changes a pricing number.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const rawCompletes = Number(sp.get("completes") ?? 500);
  const completes = Number.isFinite(rawCompletes)
    ? Math.min(5000, Math.max(100, Math.floor(rawCompletes)))
    : 500;
  const modeParam = sp.get("mode") ?? "QUOTA_UGC";
  if (!MODES.includes(modeParam as SamplingMode)) {
    return NextResponse.json(
      { error: `Unknown sampling mode: ${modeParam}. Allowed: ${MODES.join(", ")}` },
      { status: 400 },
    );
  }
  const mode = modeParam as SamplingMode;
  const metros = (sp.get("metros") ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  return NextResponse.json(estimate(completes, mode, metros));
}
