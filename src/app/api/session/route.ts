import { NextRequest, NextResponse } from "next/server";
import {
  createGuestUser,
  GUEST_COOKIE,
  resolveAuthenticatedUser,
  resolveGuest,
  setGuestCookie,
} from "@/lib/polly/session";

export const dynamic = "force-dynamic";

// Session bootstrap. Identity comes only from the Supabase JWT (Bearer
// header or Auth session cookies). No demo member, no `uid` param.
// Always 200: the frontend distinguishes signed-in / guest / anonymous
// from the payload and decides whether to show guest mode or sign-in.
export async function GET(req: NextRequest) {
  const member = await resolveAuthenticatedUser(req);
  const guest = member ? null : await resolveGuest(req);
  return NextResponse.json({
    authenticated: Boolean(member),
    member: member
      ? {
          id: member.id,
          handle: member.handle,
          displayName: member.displayName,
          tier: member.tier,
          metro: member.metro,
        }
      : null,
    guest: guest ? { id: guest.id, handle: guest.handle, displayName: guest.displayName } : null,
  });
}

// Create a device guest: a fresh guest row plus the httpOnly
// `polly_guest` cookie that identifies this device afterwards.
// No Supabase session is needed — this is the "Continue as guest" path.
// If this device already has a guest (cookie present, row found), the
// existing guest is returned instead of creating a fresh one —
// creating a new row per tap would orphan the old guest's held points.
export async function POST(req: NextRequest) {
  const existing = await resolveGuest(req);
  if (existing) {
    const res = NextResponse.json({
      guest: { id: existing.id, handle: existing.handle, displayName: existing.displayName },
      reused: true,
    });
    const token = req.cookies.get(GUEST_COOKIE)?.value;
    if (token) setGuestCookie(res, token); // refresh max-age
    return res;
  }
  const { user, token } = await createGuestUser();
  const res = NextResponse.json({
    guest: { id: user.id, handle: user.handle, displayName: user.displayName },
    reused: false,
  });
  setGuestCookie(res, token);
  return res;
}
