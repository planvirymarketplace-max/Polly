import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeWeights, weightedResults } from "@/lib/polly/sampling";

export const dynamic = "force-dynamic";

// Weighted results for one poll — raw vs census-weighted percentages
// plus quota fill, the methodology that makes results publishable.
// Public by design: aggregate results carry no identity, so this route
// takes no JWT and no `uid`. (Per-response identity stays in the vote
// route, which enforces one response per user per poll.)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const poll = await db.poll.findUnique({
    where: { id },
    include: { options: { orderBy: { position: "asc" } } },
  });
  if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });

  const responses = await db.pollResponse.findMany({ where: { pollId: id } });
  computeWeights(responses);
  const results = weightedResults(
    poll.options.map((o) => ({ id: o.id, label: o.label })),
    responses,
  );
  results.pollId = id;
  return NextResponse.json({ results });
}
