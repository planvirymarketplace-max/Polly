"use client";

// Browser Supabase client (@supabase/ssr) for the web app's sign-in
// flows (OAuth, phone OTP, magic link) and for attaching the session
// JWT to API calls. Returns null when the Supabase env vars are unset
// so the UI can show "needs configuration" instead of crashing — no
// method may fake a success when the backend is unconfigured.

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null | undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** Shared browser client, or null when Supabase is not configured. */
export function getBrowserSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (cachedClient === undefined) {
    cachedClient = createBrowserClient(url, key);
  }
  return cachedClient;
}

/** Current session access token, or null when signed out / unconfigured. */
export async function getAccessToken(): Promise<string | null> {
  const client = getBrowserSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * fetch() that attaches `Authorization: Bearer <token>` when a session
 * exists. Guest identity travels separately via the httpOnly
 * `polly_guest` cookie, which the browser sends automatically on
 * same-origin requests — no token is ever invented here.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
