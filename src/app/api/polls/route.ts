import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveActingUser, topicDTO } from "@/lib/polly/session";
import { explainSelection } from "@/lib/polly/sampling";
import type { PollCardDTO, SamplingMode } from "@/lib/polly/types";

export const dynamic = "force-dynamic";

// Poll feed: LIVE polls the user hasn't answered, each carrying a
// transparent "why you" explanation from the sampling engine,
// plus recently-closed polls for the results view.
// Identity: Supabase JWT (member) or device-guest cookie. No `uid` param.
export async function GET(req: NextRequest) {
  const user = await resolveActingUser(req);
  if (!user) return NextResponse.json({ error: "No session" }, { status: 401 });

  const polls = await db.poll.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      sponsor: true,
      topic: true,
      options: { orderBy: { position: "asc" } },
      responses: { where: { userId: user.id } },
    },
  });

  const cards: PollCardDTO[] = [];
  for (const p of polls) {
    const mine = p.responses[0];
    const answered = Boolean(mine);
    const card: PollCardDTO = {
      id: p.id,
      question: p.question,
      context: p.context,
      kind: p.kind,
      samplingMode: p.samplingMode as SamplingMode,
      rewardPoints: p.rewardPoints,
      status: p.status,
      closesAt: p.closesAt.toISOString(),
      estimatedN: p.estimatedN,
      sponsor: { name: p.sponsor.name, kind: p.sponsor.kind },
      topic: topicDTO(p.topic),
      options: p.options.map((o) => ({ id: o.id, label: o.label })),
      alreadyResponded: answered,
      myOptionId: mine?.optionId,
      explanation:
        p.status === "LIVE" && !answered
          ? explainSelection(user, {
              samplingMode: p.samplingMode as SamplingMode,
              targetMetros: p.targetMetros,
              topic: p.topic ? topicDTO(p.topic) : null,
            })
          : null,
    };
    cards.push(card);
  }

  return NextResponse.json({
    live: cards.filter((c) => c.status === "LIVE"),
    closed: cards.filter((c) => c.status === "CLOSED"),
  });
}
