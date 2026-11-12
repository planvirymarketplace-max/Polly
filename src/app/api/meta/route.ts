import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Metadata for the sponsor composer: sponsor identities + topic taxonomy.
export async function GET() {
  const sponsors = await db.sponsor.findMany({ orderBy: { name: "asc" } });
  const topics = await db.topic.findMany({ orderBy: { label: "asc" } });
  return NextResponse.json({
    sponsors: sponsors.map((s) => ({ id: s.id, name: s.name, kind: s.kind, blurb: s.blurb })),
    topics: topics.map((t) => ({ id: t.id, slug: t.slug, label: t.label, emoji: t.emoji })),
  });
}
