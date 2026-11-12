// Supabase clients for the Next.js server (Route Handlers / Server Components).
// Browser-side Supabase use is intentionally NOT set up here: the web app
// talks to Supabase Auth only through the API layer, which validates the
// JWT server-side (see src/lib/polly/session.ts).
//
// Env vars (see .env.example):
//   NEXT_PUBLIC_SUPABASE_URL       — Supabase project URL (public)
//   NEXT_PUBLIC_SUPABASE_ANON_KEY  — anon/public key (public; RLS-gated)
//   SUPABASE_SERVICE_ROLE_KEY      — service-role key, server-only, NEVER
//                                    NEXT_PUBLIC_ (see ./admin.ts)

import { createClient, type SupabaseClient, type User as SupabaseAuthUser } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export function getSupabaseAnonKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

/** Anon client (public key). Safe to use server-side for token validation. */
export function createAnonClient(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Cookie-aware server client (@supabase/ssr). Reads the Supabase Auth
 * session cookies set by the browser sign-in flow. `setAll` is a no-op:
 * Route Handlers validate the session, they do not refresh it — token
 * refresh is the client's job (or the middleware, when added).
 */
export async function createSessionClient(): Promise<SupabaseClient | null> {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) return null;
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  });
}

export interface AuthIdentity {
  supabaseId: string;
  email: string | null;
}

/**
 * Resolve the caller's Supabase identity, or null when unauthenticated.
 * Order: (1) `Authorization: Bearer <JWT>` header — the mobile app and any
 * API client send this; (2) Supabase Auth session cookies — the web
 * sign-in flow (SSO / OTP / magic link) sets these.
 * The JWT is validated against Supabase Auth on every call; no identity
 * is ever taken from a query param, request body, or client claim.
 */
export async function getSupabaseAuthUser(req: NextRequest): Promise<AuthIdentity | null> {
  const anon = createAnonClient();
  if (!anon) return null;

  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : null;
  if (bearer) {
    const { data, error } = await anon.auth.getUser(bearer);
    if (!error && data.user) return toIdentity(data.user);
  }

  try {
    const sessionClient = await createSessionClient();
    if (!sessionClient) return null;
    const { data, error } = await sessionClient.auth.getUser();
    if (!error && data.user) return toIdentity(data.user);
  } catch {
    return null;
  }
  return null;
}

function toIdentity(u: SupabaseAuthUser): AuthIdentity {
  return { supabaseId: u.id, email: u.email ?? null };
}
