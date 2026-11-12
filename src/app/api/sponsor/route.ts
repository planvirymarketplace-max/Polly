import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSupabaseAuthUser } from "@/lib/supabase/client";
import { resolveAuthenticatedUser } from "@/lib/polly/session";

export const dynamic = "force-dynamic";

const SPONSOR_KINDS = ["STATION", "NONPROFIT", "RESEARCH", "BRAND", "ADVOCACY"] as const;

const createSponsorSchema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.enum(SPONSOR_KINDS),
  blurb: z.string().trim().max(500).optional().default(""),
});

function toDTO(s: { id: string; name: string; kind: string; blurb: string | null }) {
  return { id: s.id, name: s.name, kind: s.kind, blurb: s.blurb };
}

// My sponsor orgs — the orgs owned by the authenticated user
// (Sponsor.ownerSupabaseId = JWT sub). 401 when unauthenticated.
export async function GET(req: NextRequest) {
  const identity = await getSupabaseAuthUser(req);
  if (!identity) {
    return NextResponse.json({ error: "Sign in to view your sponsor orgs" }, { status: 401 });
  }
  const sponsors = await db.sponsor.findMany({
    where: { ownerSupabaseId: identity.supabaseId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ sponsors: sponsors.map(toDTO) });
}

// Register a sponsor org owned by the authenticated user. This is the
// only way a sponsor comes into existence — the seed data contains no
// sponsors, so without this the sponsor flow is dead.
export async function POST(req: NextRequest) {
  const identity = await getSupabaseAuthUser(req);
  if (!identity) {
    return NextResponse.json({ error: "Sign in to register a sponsor org" }, { status: 401 });
  }
  // Resolve the member as well so the row is provisioned for this user.
  const member = await resolveAuthenticatedUser(req);
  if (!member) {
    return NextResponse.json({ error: "Sign in to register a sponsor org" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = createSponsorSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") },
      { status: 400 },
    );
  }

  const sponsor = await db.sponsor.create({
    data: {
      ownerSupabaseId: identity.supabaseId,
      name: parsed.data.name,
      kind: parsed.data.kind,
      blurb: parsed.data.blurb || null,
    },
  });
  return NextResponse.json({ sponsor: toDTO(sponsor) }, { status: 201 });
}
