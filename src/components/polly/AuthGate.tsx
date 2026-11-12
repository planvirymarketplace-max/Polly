"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { PollyLogo } from "./PollyLogo";
import { usePolly } from "./store";
import {
  authFetch,
  getBrowserSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabase/browser";
import {
  AppleIcon,
  ArrowRight,
  Ghost,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
} from "./AuthIcons";

type Method = "menu" | "phone" | "otp" | "magic";

export function AuthGate({
  member,
  guest,
}: {
  member: { id: string; tier: string; displayName: string } | null;
  guest: { id: string; displayName: string } | null;
}) {
  // Props are the server session snapshot from GET /api/session; identity
  // itself is established by the real flows below, never from these props.
  void member;
  void guest;

  const [method, setMethod] = useState<Method>("menu");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const { setSession } = usePolly();
  const { toast } = useToast();
  const configured = isSupabaseConfigured();

  // Claim held guest rewards into the newly signed-in member.
  // POST /api/auth/claim-guest takes no body: the JWT (Bearer) proves
  // the member and the httpOnly polly_guest cookie proves the device
  // guest. 404 means no guest on this device — nothing to claim.
  // Response shape: { claimed: { claimedPoints, memberPoints, ... } }.
  const claimGuest = async () => {
    try {
      const res = await authFetch("/api/auth/claim-guest", { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      const claimed = data?.claimed as
        | { claimedPoints?: number; memberPoints?: number }
        | undefined;
      if (claimed && (claimed.claimedPoints ?? 0) > 0) {
        toast({
          title: "Claim held points",
          description: `Claimed ${claimed.claimedPoints} held points. Your balance is now ${claimed.memberPoints}.`,
        });
      }
    } catch {
      // Claiming is best-effort: sign-in already succeeded.
    }
  };

  // Finish sign-in: resolve the member from GET /api/session (JWT),
  // claim any held guest rewards, then enter the app.
  const finishSignIn = async (): Promise<boolean> => {
    const res = await authFetch("/api/session");
    if (!res.ok) {
      toast({
        title: "Sign-in failed",
        description: "We couldn't load your account. Try again.",
        variant: "destructive",
      });
      return false;
    }
    const data = await res.json();
    if (!data.member) {
      toast({
        title: "Sign-in failed",
        description: "Your sign-in didn't return an account. Try again.",
        variant: "destructive",
      });
      return false;
    }
    await claimGuest();
    toast({
      title: "Signed in",
      description: `Welcome back, ${data.member.displayName}.`,
    });
    setSession(data.member.id, data.member.tier, false);
    return true;
  };

  // On mount: a returning session (e.g. just back from /auth/callback)
  // signs straight in; a failed callback (?auth=error) is surfaced.
  // With no session and no guest identity, stay on the gate.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("auth") === "error"
      ) {
        setAuthError("That sign-in link was invalid or expired. Try again.");
      }
      const client = getBrowserSupabaseClient();
      if (!client) return;
      const { data } = await client.auth.getSession();
      if (!data.session || cancelled) return;
      await finishSignIn();
    })();
    return () => {
      cancelled = true;
    };
    // Runs once on mount by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signInWithProvider = async (provider: "google" | "apple") => {
    const client = getBrowserSupabaseClient();
    if (!client) return;
    setBusy(provider);
    const { error } = await client.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(null);
    if (error) {
      toast({
        title: "Sign-in failed",
        description: error.message,
        variant: "destructive",
      });
    }
    // On success the browser leaves for the provider, then returns
    // via /auth/callback — finishSignIn runs on mount after that.
  };

  const sendPhoneCode = async () => {
    const client = getBrowserSupabaseClient();
    if (!client) return;
    setBusy("phone");
    const { error } = await client.auth.signInWithOtp({ phone });
    setBusy(null);
    if (error) {
      toast({
        title: "Couldn't send the code",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setMethod("otp");
    toast({
      title: "Code sent",
      description: `We texted a 6-digit code to ${phone}.`,
    });
  };

  const verifyPhoneCode = async () => {
    const client = getBrowserSupabaseClient();
    if (!client) return;
    setBusy("otp");
    const { error } = await client.auth.verifyOtp({
      phone,
      token: code,
      type: "sms",
    });
    setBusy(null);
    if (error) {
      toast({
        title: "That code didn't work",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    await finishSignIn();
  };

  const sendMagicLink = async () => {
    const client = getBrowserSupabaseClient();
    if (!client) return;
    setBusy("magic");
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(null);
    if (error) {
      toast({
        title: "Couldn't send the link",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setMagicSent(true);
    toast({
      title: "Check your email",
      description: `We sent a sign-in link to ${email}.`,
    });
  };

  const enterGuest = async () => {
    setBusy("guest");
    try {
      const res = await fetch("/api/session", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Guest sign-in failed");
      const data = await res.json();
      toast({
        title: "Browsing as guest",
        description: "Browsing as guest — rewards are held until you create an account.",
      });
      setSession(data.guest.id, "HATCHLING", true);
    } catch (e) {
      toast({
        title: "Guest mode failed",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-accent/60 via-background to-background">
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="text-primary">
              <PollyLogo size={64} />
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">Polly</h1>
            <p className="mt-2 text-balance text-muted-foreground">
              The social network for what you think — and why.
            </p>
            <Badge variant="secondary" className="mt-3 gap-1">
              <ShieldCheck className="h-3 w-3" /> Secure sign-in
            </Badge>
          </div>

          {authError && (
            <p className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
              {authError}
            </p>
          )}
          {!configured && (
            <p className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-center text-sm text-amber-700 dark:text-amber-400">
              Sign-in needs configuration — set NEXT_PUBLIC_SUPABASE_URL and
              NEXT_PUBLIC_SUPABASE_ANON_KEY.
            </p>
          )}

          {method === "menu" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col gap-2.5"
            >
              <Button
                size="lg"
                className="h-12 justify-start gap-3"
                disabled={!configured || busy !== null}
                onClick={() => signInWithProvider("apple")}
              >
                <AppleIcon className="h-5 w-5" />
                Continue with Apple
                {!configured && <span className="ml-auto text-xs font-normal opacity-70">needs configuration</span>}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 justify-start gap-3"
                disabled={!configured || busy !== null}
                onClick={() => signInWithProvider("google")}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
                  />
                </svg>
                Continue with Google
                {!configured && <span className="ml-auto text-xs font-normal opacity-70">needs configuration</span>}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 justify-start gap-3"
                disabled={!configured || busy !== null}
                onClick={() => setMethod("phone")}
              >
                <Phone className="h-5 w-5" />
                Continue with phone
                {!configured && <span className="ml-auto text-xs font-normal opacity-70">needs configuration</span>}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 justify-start gap-3"
                disabled={!configured || busy !== null}
                onClick={() => setMethod("magic")}
              >
                <Mail className="h-5 w-5" />
                Email magic link
                {!configured && <span className="ml-auto text-xs font-normal opacity-70">needs configuration</span>}
              </Button>

              <div className="my-2 flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">or</span>
                <Separator className="flex-1" />
              </div>

              <Button
                size="lg"
                variant="ghost"
                className="h-12 gap-2 text-muted-foreground"
                disabled={busy !== null}
                onClick={enterGuest}
              >
                <Ghost className="h-5 w-5" />
                {busy === "guest" ? "Starting guest mode…" : "Continue as guest"}
                <Badge variant="outline" className="ml-1 text-[10px] font-normal">
                  limited
                </Badge>
              </Button>
            </motion.div>
          )}

          {method === "phone" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
              <label htmlFor="polly-phone" className="text-sm font-medium">
                Phone number
              </label>
              <Input
                id="polly-phone"
                inputMode="tel"
                placeholder="(555) 010-2299"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-12 text-base"
              />
              <Button
                size="lg"
                className="h-12 gap-2"
                disabled={!configured || phone.replace(/\D/g, "").length < 7 || busy !== null}
                onClick={sendPhoneCode}
              >
                {busy === "phone" ? "Sending…" : "Send code"} <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" className="text-muted-foreground" onClick={() => setMethod("menu")}>
                Back
              </Button>
            </motion.div>
          )}

          {method === "otp" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code we texted to {phone}.
              </p>
              <div className="flex justify-center py-2">
                <InputOTP maxLength={6} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button
                size="lg"
                className="h-12"
                disabled={!configured || code.length < 6 || busy !== null}
                onClick={verifyPhoneCode}
              >
                {busy === "otp" ? "Verifying…" : "Verify & enter Polly"}
              </Button>
              <Button variant="ghost" className="text-muted-foreground" onClick={() => setMethod("phone")}>
                Wrong number?
              </Button>
            </motion.div>
          )}

          {method === "magic" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
              {magicSent ? (
                <>
                  <p className="text-center text-sm text-muted-foreground">
                    Check your email — we sent a sign-in link to{" "}
                    <span className="font-medium text-foreground">{email}</span>. It expires
                    soon, so open it from this device.
                  </p>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12"
                    disabled={busy !== null}
                    onClick={() => setMagicSent(false)}
                  >
                    Use a different email
                  </Button>
                </>
              ) : (
                <>
                  <label htmlFor="polly-email" className="text-sm font-medium">
                    Email
                  </label>
                  <Input
                    id="polly-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 text-base"
                  />
                  <Button
                    size="lg"
                    className="h-12 gap-2"
                    disabled={!configured || !email.includes("@") || busy !== null}
                    onClick={sendMagicLink}
                  >
                    <Mail className="h-4 w-4" /> {busy === "magic" ? "Sending…" : "Send magic link"}
                  </Button>
                </>
              )}
              <Button variant="ghost" className="text-muted-foreground" onClick={() => setMethod("menu")}>
                Back
              </Button>
            </motion.div>
          )}

          <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            Supabase auth · Apple, Google, phone OTP, magic link, guest
          </p>
        </motion.div>
      </div>
    </div>
  );
}
