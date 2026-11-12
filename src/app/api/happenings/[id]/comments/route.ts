import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveActingUser } from "@/lib/polly/session";

export const dynamic = "force-dynamic";

// Post commentary on a happening. The interest graph grows from this UGC —
// this is the signal the sampling engine learns from.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { body?: string };
  try {
    body = (await req.json()) as { body?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const text = (body.body ?? "").trim();
  if (!text) return NextResponse.json({ error: "Say something first" }, { status: 400 });
  if (text.length > 500) return NextResponse.json({ error: "Keep it under 500 characters" }, { status: 400 });

  // Identity comes only from the JWT (member) or the device-guest
  // cookie — never from a client-supplied id in the body.
  const user = await resolveActingUser(req);
  if (!user) return NextResponse.json({ error: "No session" }, { status: 401 });

  const happening = await db.happening.findUnique({ where: { id }, include: { topic: true } });
  if (!happening) return NextResponse.json({ error: "Happening not found" }, { status: 404 });

  const comment = await db.comment.create({
    data: { body: text, userId: user.id, happeningId: id },
    include: { user: true },
  });
  await db.happening.update({ where: { id }, data: { commentCount: { increment: 1 } } });
  await db.user.update({ where: { id: user.id }, data: { commentsPosted: { increment: 1 } } });

  // UGC signal: commenting on a topic nudges the interest graph.
  if (happening.topic) {
    const existing = await db.userInterest.findUnique({
      where: { userId_topicId: { userId: user.id, topicId: happening.topicId! } },
    });
    if (existing) {
      await db.userInterest.update({
        where: { userId_topicId: { userId: user.id, topicId: happening.topicId! } },
        data: { affinity: Math.min(1, existing.affinity + 0.03) },
      });
    } else {
      await db.userInterest.create({
        data: { userId: user.id, topicId: happening.topicId!, affinity: 0.3 },
      });
    }
  }

  return NextResponse.json({
    comment: {
      id: comment.id,
      body: comment.body,
      likes: comment.likes,
      createdAt: comment.createdAt.toISOString(),
      author: {
        handle: comment.user.handle,
        displayName: comment.user.displayName,
        tier: comment.user.tier,
      },
    },
    interestNudge: happening.topic ? happening.topic.label : null,
  });
}
