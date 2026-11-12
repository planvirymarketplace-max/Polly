import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSupabaseAuthUser } from "@/lib/supabase/client";
import { resolveAuthenticatedUser } from "@/lib/polly/session";
import { ingestAll } from "@/lib/polly/rss";

export const dynamic = "force-dynamic";

const triggerSchema = z.object({
  limit: z.number().int().min(1).max(50).optional(),
  dryRun: z.boolean().optional(),
});

// Admin/sponsor-gated trigger for RSS ingestion. Runs the same
// ingestAll() as scripts/ingest-rss.ts against the app's database.
// Returns per-feed counts; a failed feed is reported, not hidden.
// Requires a Supabase JWT and at least one sponsor org owned by the
// caller (Sponsor.ownerSupabaseId === JWT sub).
export async function POST(req: NextRequest) {
  const identity = await getSupabaseAuthUser(req);
  if (!identity) {
    return NextResponse.json({ error: "Sign in to trigger ingestion" }, { status: 401 });
  }
  const member = await resolveAuthenticatedUser(req);
  if (!member) {
    return NextResponse.json({ error: "Sign in to trigger ingestion" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = triggerSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") },
      { status: 400 },
    );
  }
  const { limit, dryRun } = parsed.data;

  const sponsor = await db.sponsor.findFirst({
    where: { ownerSupabaseId: identity.supabaseId },
  });
  if (!sponsor) {
    return NextResponse.json(
      { error: "Register a sponsor org first" },
      { status: 403 },
    );
  }

  const report = await ingestAll(db, { limitPerFeed: limit ?? 10, dryRun: dryRun ?? false });
  return NextResponse.json({ report });
}
