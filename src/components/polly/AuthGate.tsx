"use client";

import { useState } from "react";
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
  member: { id: string; tier: string; displayName: string };
  guest: { id: string; displayName: string };
}) {
  const [method, setMethod] = useState<Method>("menu");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const { setSession } = usePolly();
  const { toast } = useToast();

  const enterMember = () => {
    toast({
      title: "Welcome back, Maya",
      description: "Demo build — any sign-in method opens the seeded member account.",
    });
    setSession(member.id, member.tier, false);
  };

  const enterGuest = () => {
    toast({
      title: "Browsing as guest",
      description: "You can vote, but rewards are held until you create an account.",
    });
    setSession(guest.id, "HATCHLING", true);
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
              <ShieldCheck className="h-3 w-3" /> Demo build · seeded data
            </Badge>
          </div>

          {method === "menu" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col gap-2.5"
            >
              <Button size="lg" className="h-12 justify-start gap-3" onClick={enterMember}>
                <AppleIcon className="h-5 w-5" />
                Continue with Apple
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 justify-start gap-3"
                onClick={enterMember}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
                  />
                </svg>
                Continue with Google
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 justify-start gap-3"
                onClick={() => setMethod("phone")}
              >
                <Phone className="h-5 w-5" />
                Continue with phone
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 justify-start gap-3"
                onClick={() => setMethod("magic")}
              >
                <Mail className="h-5 w-5" />
                Email magic link
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
                onClick={enterGuest}
              >
                <Ghost className="h-5 w-5" />
                Continue as guest
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
                disabled={phone.replace(/\D/g, "").length < 7}
                onClick={() => setMethod("otp")}
              >
                Send code <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" className="text-muted-foreground" onClick={() => setMethod("menu")}>
                Back
              </Button>
            </motion.div>
          )}

          {method === "otp" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code we texted you.{" "}
                <span className="text-foreground">(Demo: any code works.)</span>
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
              <Button size="lg" className="h-12" disabled={code.length < 6} onClick={enterMember}>
                Verify &amp; enter Polly
              </Button>
              <Button variant="ghost" className="text-muted-foreground" onClick={() => setMethod("phone")}>
                Wrong number?
              </Button>
            </motion.div>
          )}

          {method === "magic" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
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
                disabled={!email.includes("@")}
                onClick={enterMember}
              >
                <Mail className="h-4 w-4" /> Send magic link
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Demo: the link is already in your inbox.
              </p>
              <Button variant="ghost" className="text-muted-foreground" onClick={() => setMethod("menu")}>
                Back
              </Button>
            </motion.div>
          )}

          <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            Supabase auth in production · Apple, Google, phone OTP, magic link, guest
          </p>
        </motion.div>
      </div>
    </div>
  );
}
