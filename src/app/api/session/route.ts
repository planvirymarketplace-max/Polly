import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveUser, resolveGuest } from "@/lib/polly/session";

export const dynamic = "force-dynamic";

// Demo session bootstrap. Production: Supabase getSession().
export async function GET() {
  const member = await resolveUser(null);
  const guest = await resolveGuest();
  if (!member || !guest) {
    return NextResponse.json({ error: "Seed missing — run scripts/seed.ts" }, { status: 500 });
  }
  return NextResponse.json({
    member: {
      id: member.id,
      handle: member.handle,
      displayName: member.displayName,
      tier: member.tier,
      metro: member.metro,
    },
    guest: { id: guest.id, handle: guest.handle, displayName: guest.displayName },
  });
}
