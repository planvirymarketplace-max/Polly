// Supabase client for Polly mobile.
//
// Configuration comes ONLY from public env vars — never hardcode keys:
//   EXPO_PUBLIC_SUPABASE_URL       e.g. https://<project-ref>.supabase.co
//   EXPO_PUBLIC_SUPABASE_ANON_KEY  the project's publishable/anon key
//
// If either is missing, `supabase` is null and `isSupabaseConfigured` is
// false. The auth UI then shows every method as "coming soon — needs
// configuration" instead of faking a sign-in. Sunny must supply these two
// values (Supabase project settings → API) before any auth method works.
//
// Token storage: expo-secure-store on iOS/Android (hardware-backed
// keychain/keystore), plain localStorage on web (SecureStore has no
// meaningful web backing store). No AsyncStorage dependency is needed.

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { makeRedirectUri } from "expo-auth-session";

export const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim();
export const SUPABASE_ANON_KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const missingSupabaseConfig: string[] = [
  ...(SUPABASE_URL ? [] : ["EXPO_PUBLIC_SUPABASE_URL"]),
  ...(SUPABASE_ANON_KEY ? [] : ["EXPO_PUBLIC_SUPABASE_ANON_KEY"]),
];

/** OAuth / magic-link return address: polly://auth/callback */
export const OAUTH_REDIRECT_URL = makeRedirectUri({
  scheme: "polly",
  path: "auth/callback",
});

const webStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // storage unavailable (private mode) — session just won't persist
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

/** Null when Supabase is not configured — callers must check first. */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: Platform.OS === "web" ? webStorage : secureStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
