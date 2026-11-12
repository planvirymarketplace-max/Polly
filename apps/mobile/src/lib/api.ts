// Polly mobile API client.
// Points at the web app's API (sandbox preview URL or your Lightsail host).
// Swap the base URL per environment; auth headers plug in when Supabase lands.

import Constants from "expo-constants";

const BASE =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  "http://localhost:3000";

export interface ApiResponse<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Request failed: ${res.status}`);
  return json as T;
}

export const api = {
  session: () =>
    request<{
      member: { id: string; handle: string; displayName: string; tier: string };
      guest: { id: string; handle: string; displayName: string };
    }>("/api/session"),

  happenings: () => request<{ happenings: never[] }>("/api/happenings"),

  vote: (pollId: string, optionId: string, uid: string) =>
    request<Record<string, never>>(`/api/polls/${pollId}/vote`, {
      method: "POST",
      body: JSON.stringify({ optionId, uid }),
    }),

  polls: (uid: string) => request<{ live: never[]; closed: never[] }>(`/api/polls?uid=${uid}`),

  wallet: (uid: string) => request<Record<string, never>>(`/api/wallet?uid=${uid}`),

  profile: (uid: string) => request<Record<string, never>>(`/api/profile?uid=${uid}`),
};
