"use client";

import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { PollyLogo } from "./PollyLogo";
import { usePolly, type AppView } from "./store";
import { usePolls, useWallet } from "./hooks";
import { FeedView } from "./FeedView";
import { PollsView } from "./PollsView";
import { RewardsView } from "./RewardsView";
import { ProfileView } from "./ProfileView";
import { SponsorView } from "./SponsorView";
import {
  BarChart3,
  Briefcase,
  CircleUserRound,
  Coins,
  Gift,
  Moon,
  Newspaper,
  Sun,
} from "lucide-react";

const TABS: { key: AppView; label: string; icon: typeof Newspaper }[] = [
  { key: "feed", label: "The Commons", icon: Newspaper },
  { key: "polls", label: "Polls", icon: BarChart3 },
  { key: "rewards", label: "Rewards", icon: Gift },
  { key: "profile", label: "You", icon: CircleUserRound },
];

function PhoneHeader() {
  const { view, setView, tier, userId, setMode } = usePolly();
  const { data: wallet } = useWallet(userId);
  const { data: polls } = usePolls(userId);
  const { theme, setTheme } = useTheme();
  const unanswered = (polls?.live ?? []).filter((p) => !p.alreadyResponded).length;

  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          className="flex items-center gap-2"
          onClick={() => setView("feed")}
          aria-label="Polly home"
        >
          <span className="text-primary">
            <PollyLogo size={30} />
          </span>
          <span className="text-lg font-bold tracking-tight">Polly</span>
          <Badge variant="outline" className="hidden text-[10px] font-normal text-muted-foreground sm:inline-flex">
            demo
          </Badge>
        </button>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setView("rewards")}
            className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-500/25 dark:text-amber-400"
            aria-label="Your points"
          >
            <Coins className="h-4 w-4" />
            {wallet ? wallet.points.toLocaleString() : "…"}
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle dark mode"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <button
            onClick={() => setView("profile")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground ring-2 ring-primary/25"
            aria-label="Your profile"
          >
            {(tier ?? "H").slice(0, 1)}
          </button>
        </div>
      </div>
      {view !== "profile" && (
        <div className="flex gap-1.5 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                view === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/70 text-muted-foreground hover:bg-secondary"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              {t.key === "polls" && unanswered > 0 && (
                <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-amber-950">
                  {unanswered}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}

function PhoneTabBar() {
  const { view, setView, userId } = usePolly();
  const { data: polls } = usePolls(userId);
  const unanswered = (polls?.live ?? []).filter((p) => !p.alreadyResponded).length;

  return (
    <nav
      className="sticky bottom-0 z-20 border-t border-border/70 bg-background/90 backdrop-blur-md"
      aria-label="Primary"
    >
      <div className="grid grid-cols-4 px-2 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-1.5">
        {TABS.map((t) => {
          const active = view === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className={`relative flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-[10px] font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <span className="relative">
                <t.icon className="h-5 w-5" />
                {t.key === "polls" && unanswered > 0 && (
                  <span className="absolute -right-1.5 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[9px] font-bold text-amber-950">
                    {unanswered}
                  </span>
                )}
              </span>
              {t.label}
              {active && (
                <motion.span
                  layoutId="tab-dot"
                  className="absolute -top-1.5 h-1 w-6 rounded-full bg-primary"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function AppBody() {
  const { view } = usePolly();
  switch (view) {
    case "feed":
      return <FeedView />;
    case "polls":
      return <PollsView />;
    case "rewards":
      return <RewardsView />;
    case "profile":
      return <ProfileView />;
  }
}

export function AppShell() {
  const { setMode } = usePolly();
  const { toast } = useToast();

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl items-center justify-center gap-12 px-0 py-0 lg:px-8 lg:py-10">
      {/* Desktop brand panel */}
      <aside className="hidden max-w-sm flex-1 lg:block">
        <div className="text-primary">
          <PollyLogo size={56} />
        </div>
        <h1 className="mt-5 text-4xl font-bold tracking-tight">
          Polly
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          The social network for what you think — and why. TikTok owns dancing.
          Facebook owns friends. <span className="text-foreground">Polly owns ideas.</span>
        </p>
        <ul className="mt-6 space-y-3 text-sm">
          {[
            ["Engage", "A national feed of local and national happenings. Comment, discuss, galvanize."],
            ["Get selected", "The system matches sponsored polls to your engagement — transparently. You always see why you were picked."],
            ["Earn", "Points, sweepstakes entries, and revenue share from every sponsored poll you complete. Never 100 surveys for $10."],
          ].map(([title, body]) => (
            <li key={title} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                {title.slice(0, 1)}
              </span>
              <span>
                <span className="font-semibold">{title} — </span>
                <span className="text-muted-foreground">{body}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex items-center gap-3">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              toast({
                title: "Sponsor mode",
                description: "The dashboard where stations, nonprofits and brands buy polls.",
              });
              setMode("sponsor");
            }}
          >
            <Briefcase className="h-4 w-4" /> For sponsors
          </Button>
          <span className="text-xs text-muted-foreground">
            This is the mobile app — the Expo build runs the same screens.
          </span>
        </div>
      </aside>

      {/* The phone */}
      <div className="w-full max-w-[430px] shrink-0 lg:rounded-[2.4rem] lg:border-[10px] lg:border-foreground/10 lg:shadow-2xl lg:shadow-foreground/10">
        <div className="flex min-h-dvh flex-col bg-background lg:min-h-0 lg:h-[820px] lg:max-h-[85vh]">
          <PhoneHeader />
          <main className="flex-1 overflow-y-auto" role="main">
            <AppBody />
          </main>
          <PhoneTabBar />
        </div>
      </div>
    </div>
  );
}

export function AppLoading() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ repeat: Infinity, duration: 1.4 }}
        className="text-primary"
      >
        <PollyLogo size={64} />
      </motion.div>
      <p className="text-sm text-muted-foreground">gathering the flock…</p>
      <Skeleton className="mt-4 h-3 w-40 rounded-full" />
    </div>
  );
}
