import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { topicDTO } from "@/lib/polly/session";
import type { HappeningDTO } from "@/lib/polly/types";

export const dynamic = "force-dynamic";

// The Commons — feed of local + national geo-political happenings.
export async function GET() {
  const happenings = await db.happening.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      topic: true,
      comments: {
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { user: true },
      },
    },
  });

  const dto: HappeningDTO[] = happenings.map((h) => ({
    id: h.id,
    title: h.title,
    summary: h.summary,
    sourceName: h.sourceName,
    metro: h.metro,
    stateCode: h.stateCode,
    hotness: h.hotness,
    commentCount: h.commentCount,
    createdAt: h.createdAt.toISOString(),
    topic: topicDTO(h.topic),
    comments: h.comments.map((c) => ({
      id: c.id,
      body: c.body,
      likes: c.likes,
      createdAt: c.createdAt.toISOString(),
      author: {
        handle: c.user.handle,
        displayName: c.user.displayName,
        tier: c.user.tier,
      },
    })),
  }));

  return NextResponse.json({ happenings: dto });
}
