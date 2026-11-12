import { NextRequest, NextResponse } from "next/server";
import { estimate } from "@/lib/polly/pricing";
import type { SamplingMode } from "@/lib/polly/types";

export const dynamic = "force-dynamic";

// Live price estimate while a sponsor composes a poll —
// the "drive down polling cost" thesis, in numbers.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const completes = Math.min(5000, Math.max(100, Number(sp.get("completes") ?? 500)));
  const mode = (sp.get("mode") ?? "QUOTA_UGC") as SamplingMode;
  const metros = (sp.get("metros") ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  return NextResponse.json(estimate(completes, mode, metros));
}
