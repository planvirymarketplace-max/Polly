// Auth state for Polly mobile, backed by Supabase Auth.
//
// Methods supported (all real, none faked):
//   - Google + Apple SSO via Supabase OAuth, redirect polly://auth/callback
//   - Phone OTP (Supabase phone auth — needs Twilio configured in Supabase)
//   - Magic link (Supabase email OTP)
//   - Guest mode: Supabase anonymous sign-in when enabled in the project;
//     otherwise a local-only guest (feed browsing only, no voting, no
//     held points) so the app still works without any backend config.
//
// A method whose configuration is missing does NOT pretend to work:
// it returns { ok: false, needsConfig: true } and the UI shows
// "coming soon — needs configuration". A provider that is not enabled in
// Supabase returns Supabase's own error, shown verbatim.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import type { Session, User } from "@supabase/supabase-js";
import { OAUTH_REDIRECT_URL, isSupabaseConfigured, missingSupabaseConfig, supabase } from "./supabase";
import { clearAuthToken, setAuthToken } from "./api";

WebBrowser.maybeCompleteAuthSession();

const LOCAL_GUEST_KEY = "polly.local-guest";

export type AuthStatus = "loading" | "signed-in" | "guest" | "signed-out";

export interface AuthResult {
  ok: boolean;
  error?: string;
  /** True when the failure is missing configuration, not a user error. */
  needsConfig?: boolean;
  /** Human message for magic-link-style "check your inbox" flows. */
  message?: string;
}

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  /** True for anonymous Supabase users AND local-only guests. */
  isGuest: boolean;
  /** True only for the local-only guest (no Supabase session at all). */
  isLocalGuest: boolean;
  isSupabaseConfigured: boolean;
  missingConfig: string[];
  lastError: string | null;
  signInWithGoogle: () => Promise<AuthResult>;
  signInWithApple: () => Promise<AuthResult>;
  sendPhoneOtp: (phone: string) => Promise<AuthResult>;
  verifyPhoneOtp: (phone: string, code: string) => Promise<AuthResult>;
  sendMagicLink: (email: string) => Promise<AuthResult>;
  continueAsGuest: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function getLocalGuestFlag(): Promise<boolean> {
  try {
    if (Platform.OS === "web") return window.localStorage.getItem(LOCAL_GUEST_KEY) === "1";
    return (await SecureStore.getItemAsync(LOCAL_GUEST_KEY)) === "1";
  } catch {
    return false;
  }
}

async function setLocalGuestFlag(value: boolean): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (value) window.localStorage.setItem(LOCAL_GUEST_KEY, "1");
      else window.localStorage.removeItem(LOCAL_GUEST_KEY);
      return;
    }
    if (value) await SecureStore.setItemAsync(LOCAL_GUEST_KEY, "1");
    else await SecureStore.deleteItemAsync(LOCAL_GUEST_KEY);
  } catch {
    // flag is best-effort; auth state itself lives in Supabase storage
  }
}

const needsConfigResult = (): AuthResult => ({
  ok: false,
  needsConfig: true,
  error: `Sign-in isn't configured yet — missing: ${missingSupabaseConfig.join(", ")}.`,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLocalGuest, setIsLocalGuest] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const applySession = useCallback((s: Session | null) => {
    setSession(s);
    setUser(s?.user ?? null);
    if (s?.access_token) {
      setAuthToken(s.access_token);
      setIsLocalGuest(false);
      void setLocalGuestFlag(false);
      setStatus(s.user.is_anonymous ? "guest" : "signed-in");
    } else {
      clearAuthToken();
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!supabase) {
        if (mounted) setStatus((await getLocalGuestFlag()) ? "guest" : "signed-out");
        if (mounted && (await getLocalGuestFlag())) setIsLocalGuest(true);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session) {
        applySession(data.session);
      } else if (await getLocalGuestFlag()) {
        setIsLocalGuest(true);
        setStatus("guest");
      } else {
        setStatus("signed-out");
      }
    })();
    if (!supabase) return undefined;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      if (s) applySession(s);
      else {
        clearAuthToken();
        setSession(null);
        setUser(null);
        setStatus("signed-out");
      }
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [applySession]);

  const signInWithOAuth = useCallback(
    async (provider: "google" | "apple"): Promise<AuthResult> => {
      if (!supabase) return needsConfigResult();
      setLastError(null);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: OAUTH_REDIRECT_URL, skipBrowserRedirect: true },
      });
      if (error) {
        setLastError(error.message);
        return { ok: false, error: error.message };
      }
      if (!data.url) return { ok: false, error: "Supabase did not return a sign-in URL." };
      const result = await WebBrowser.openAuthSessionAsync(data.url, OAUTH_REDIRECT_URL);
      if (result.type !== "success" || !result.url) {
        return { ok: false, error: "Sign-in was cancelled." };
      }
      let code: string | null = null;
      try {
        code = new URL(result.url).searchParams.get("code");
      } catch {
        code = null;
      }
      if (!code) return { ok: false, error: "No sign-in code came back from the provider." };
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        setLastError(exchangeError.message);
        return { ok: false, error: exchangeError.message };
      }
      return { ok: true };
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      session,
      isGuest: status === "guest" || user?.is_anonymous === true,
      isLocalGuest,
      isSupabaseConfigured,
      missingConfig: missingSupabaseConfig,
      lastError,
      signInWithGoogle: () => signInWithOAuth("google"),
      signInWithApple: () => signInWithOAuth("apple"),
      sendPhoneOtp: async (phone) => {
        if (!supabase) return needsConfigResult();
        setLastError(null);
        const { error } = await supabase.auth.signInWithOtp({ phone: phone.trim() });
        if (error) {
          setLastError(error.message);
          return { ok: false, error: error.message };
        }
        return { ok: true, message: "Code sent — enter it below." };
      },
      verifyPhoneOtp: async (phone, code) => {
        if (!supabase) return needsConfigResult();
        setLastError(null);
        const { data, error } = await supabase.auth.verifyOtp({
          phone: phone.trim(),
          token: code.trim(),
          type: "sms",
        });
        if (error) {
          setLastError(error.message);
          return { ok: false, error: error.message };
        }
        if (data.session) applySession(data.session);
        return { ok: true };
      },
      sendMagicLink: async (email) => {
        if (!supabase) return needsConfigResult();
        setLastError(null);
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: OAUTH_REDIRECT_URL },
        });
        if (error) {
          setLastError(error.message);
          return { ok: false, error: error.message };
        }
        return { ok: true, message: "Check your email for the sign-in link." };
      },
      continueAsGuest: async () => {
        setLastError(null);
        if (supabase) {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (!error && data.session) {
            applySession(data.session);
            return { ok: true };
          }
          // Anonymous sign-ins disabled in this Supabase project — fall
          // through to local-only guest mode and say so honestly.
          if (error) setLastError(`Anonymous sign-in is not enabled in Supabase (${error.message}) — browsing as a local guest instead.`);
        }
        await setLocalGuestFlag(true);
        setIsLocalGuest(true);
        setStatus("guest");
        return {
          ok: true,
          message: "Browsing as a guest. Sign in to vote and earn points.",
        };
      },
      signOut: async () => {
        if (supabase) await supabase.auth.signOut();
        await setLocalGuestFlag(false);
        setIsLocalGuest(false);
        clearAuthToken();
        setSession(null);
        setUser(null);
        setStatus("signed-out");
      },
    }),
    [status, user, session, isLocalGuest, lastError, signInWithOAuth, applySession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
