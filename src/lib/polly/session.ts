// Session resolution — Supabase Auth (JWT) + device-guest mode.
//
// Identity comes ONLY from a Supabase JWT, validated server-side on every
// request (Authorization: Bearer <JWT>, or the Supabase Auth session
// cookies). There is no `uid` query-param / body auth anywhere in this
// file or in the routes that use it: a caller who cannot present a valid
// JWT is anonymous, full stop. The old demo fallback (hardcoded member /
// guest handles) is gone.
//
// Two kinds of acting user:
//   MEMBER — a Supabase Auth user. Their Prisma User row is keyed by
//     `supabaseId` (auth.users id) and auto-provisioned on first sight.
//   GUEST  — limited guest mode. The guest's Prisma User row is keyed by
//     a random device token stored ONLY in a server-set httpOnly cookie
//     (`polly_guest`). The token is never accepted from a query param or
//     request body, and the client cannot choose another guest's token —
//     it only ever presents the cookie the server set for this device.
//     Guest rewards land in `unclaimedPoints` (see rewards.ts / the vote
//     route) and are claimed on signup via POST /api/auth/claim-guest.

import { randomUUID } from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import { Prisma, type User } from "@prisma/client";
import { db } from "@/lib/db";
import { getSupabaseAuthUser, type AuthIdentity } from "@/lib/supabase/client";

export const GUEST_COOKIE = "polly_guest";
const GUEST_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 days

export type UserWithInterests = Prisma.UserGetPayload<{
  include: { interests: { include: { topic: true } } };
}>;

const withInterests = {
  include: { interests: { include: { topic: true } } },
} as const;

/**
 * The signed-in member for this request, or null when there is no valid
 * JWT. Auto-provisions the Prisma User row on first login (by supabaseId,
 * falling back to a match on email for accounts created before the
 * Supabase linkage existed).
 */
export async function resolveAuthenticatedUser(req: NextRequest): Promise<UserWithInterests | null> {
  const identity = await getSupabaseAuthUser(req);
  if (!identity) return null;
  return findOrProvisionMember(identity);
}

/**
 * The device guest for this request, or null when the request carries no
 * `polly_guest` cookie (or the token matches no guest row). Never creates
 * a guest row — creation happens explicitly in the vote route, where the
 * response can carry the Set-Cookie header.
 */
export async function resolveGuest(req: NextRequest): Promise<UserWithInterests | null> {
  const token = req.cookies.get(GUEST_COOKIE)?.value;
  if (!token) return null;
  return db.user.findUnique({
    where: { guestToken: token, accountType: "GUEST" },
    ...withInterests,
  });
}

/**
 * The acting user for this request: the signed-in member when a valid JWT
 * is present, otherwise the device guest. Null when neither exists —
 * callers turn that into a 401 (or, for voting, create a guest).
 */
export async function resolveActingUser(req: NextRequest): Promise<UserWithInterests | null> {
  return (await resolveAuthenticatedUser(req)) ?? (await resolveGuest(req));
}

/**
 * Create a fresh device-guest row. Returns the row plus the token the
 * caller must set as the `polly_guest` httpOnly cookie on the response
 * (see `setGuestCookie`). The handle is derived from the token so it can
 * never collide with a member handle.
 */
export async function createGuestUser(): Promise<{ user: UserWithInterests; token: string }> {
  const token = randomUUID();
  const user = await db.user.create({
    data: {
      handle: `guest_${token.replaceAll("-", "")}`,
      displayName: "Guest",
      accountType: "GUEST",
      guestToken: token,
    },
    ...withInterests,
  });
  return { user, token };
}

/** Set the device-guest cookie on a response (httpOnly, so JS can't read it). */
export function setGuestCookie(res: NextResponse, token: string): void {
  res.cookies.set(GUEST_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GUEST_COOKIE_MAX_AGE_SECONDS,
  });
}

/** Clear the device-guest cookie (after a successful guest claim). */
export function clearGuestCookie(res: NextResponse): void {
  res.cookies.delete(GUEST_COOKIE);
}

/**
 * @deprecated `uid`-based auth was removed with the Supabase migration:
 * identity comes only from the JWT. This overload exists solely so the
 * one route not yet rewired (POST /api/happenings/[id]/comments) still
 * typechecks — it always resolves to null (fail closed, → 401) until
 * that route passes the request through. Do not call it from new code.
 */
export async function resolveUser(req: NextRequest): Promise<UserWithInterests | null>;
export async function resolveUser(legacy: string | null): Promise<UserWithInterests | null>;
export async function resolveUser(input: NextRequest | string | null): Promise<UserWithInterests | null> {
  if (typeof input !== "object" || input === null) {
    // Legacy `uid` string (or null): no longer a source of identity.
    return null;
  }
  return resolveActingUser(input);
}

async function findOrProvisionMember(identity: AuthIdentity): Promise<UserWithInterests> {
  const bySupabaseId = await db.user.findUnique({
    where: { supabaseId: identity.supabaseId },
    ...withInterests,
  });
  if (bySupabaseId) return bySupabaseId;

  // Pre-Supabase member row (same email, no supabaseId yet): link it.
  if (identity.email) {
    const byEmail = await db.user.findUnique({ where: { email: identity.email }, ...withInterests });
    if (byEmail) {
      return db.user.update({
        where: { id: byEmail.id },
        data: { supabaseId: identity.supabaseId },
        ...withInterests,
      });
    }
  }

  const handle = await uniqueHandle(identity);
  return db.user.create({
    data: {
      supabaseId: identity.supabaseId,
      email: identity.email,
      handle,
      displayName: handle,
      accountType: "MEMBER",
    },
    ...withInterests,
  });
}

async function uniqueHandle(identity: AuthIdentity): Promise<string> {
  const base =
    identity.email
      ?.split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 20) || `member_${identity.supabaseId.slice(0, 8)}`;
  for (let i = 0; i < 100; i++) {
    const candidate = i === 0 ? base : `${base}_${i}`;
    const taken = await db.user.findUnique({ where: { handle: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `member_${identity.supabaseId.slice(0, 8)}_${Date.now().toString(36)}`;
}

export function topicDTO(t: { slug: string; label: string; emoji: string | null } | null) {
  return t ? { slug: t.slug, label: t.label, emoji: t.emoji } : null;
}
