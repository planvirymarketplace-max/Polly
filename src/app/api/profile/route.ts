import { NextRequest, NextResponse } from "next/server";
import { resolveActingUser, topicDTO } from "@/lib/polly/session";
import type { ProfileDTO } from "@/lib/polly/types";

export const dynamic = "force-dynamic";

// Profile + the interest graph the system has inferred from UGC.
// Transparency is the product: users see exactly what Polly knows.
// Identity: Supabase JWT (member) or device-guest cookie. No `uid` param.
export async function GET(req: NextRequest) {
  const user = await resolveActingUser(req);
  if (!user) return NextResponse.json({ error: "No session" }, { status: 401 });

  const dto: ProfileDTO = {
    handle: user.handle,
    displayName: user.displayName,
    accountType: user.accountType as "MEMBER" | "GUEST",
    metro: user.metro,
    stateCode: user.stateCode,
    ageBracket: user.ageBracket,
    genderBucket: user.genderBucket,
    tier: user.tier as ProfileDTO["tier"],
    followerCount: user.followerCount,
    pollsAnswered: user.pollsAnswered,
    commentsPosted: user.commentsPosted,
    interests: user.interests
      .sort((a, b) => b.affinity - a.affinity)
      .map((i) => ({ topic: topicDTO(i.topic)!, affinity: i.affinity })),
  };
  return NextResponse.json(dto);
}
