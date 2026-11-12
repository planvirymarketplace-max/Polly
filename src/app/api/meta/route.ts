import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Metadata for the sponsor composer: sponsor identities, topic taxonomy,
// and verified creator channels (CREATOR sampling mode).
export async function GET() {
  const sponsors = await db.sponsor.findMany({ orderBy: { name: "asc" } });
  const topics = await db.topic.findMany({ orderBy: { label: "asc" } });
  const creators = await db.user.findMany({
    where: { isCreator: true },
    orderBy: { followerCount: "desc" },
    select: { id: true, handle: true, displayName: true, followerCount: true },
  });
  return NextResponse.json({
    sponsors: sponsors.map((s) => ({ id: s.id, name: s.name, kind: s.kind, blurb: s.blurb })),
    topics: topics.map((t) => ({ id: t.id, slug: t.slug, label: t.label, emoji: t.emoji })),
    creators,
  });
}
