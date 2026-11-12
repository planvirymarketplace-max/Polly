// Service-role Supabase client — SERVER ONLY.
//
// Uses SUPABASE_SERVICE_ROLE_KEY, which bypasses Row Level Security.
// Rules:
//   - Import this file ONLY from server code (Route Handlers / server
//     actions). Never from a "use client" module.
//   - Prefer Prisma (`@/lib/db`) for app data. Reach for the admin client
//     only for Auth-admin operations Prisma cannot do (e.g. looking up /
//     managing Supabase Auth users).
//   - Never log, return, or expose the service-role key.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Throws when the service-role credentials are not configured. */
export function createSupabaseAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase service-role credentials are not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-only).",
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
