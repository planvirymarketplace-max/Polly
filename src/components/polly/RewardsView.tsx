"use client";

import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { TIERS } from "@/lib/polly/rewards";
import { useWallet } from "./hooks";
import { usePolly } from "./store";
import {
  ArrowUpRight,
  Coins,
  Gift,
  Sparkles,
  Ticket,
  TrendingUp,
} from "lucide-react";

const KIND_META: Record<string, { icon: typeof Coins; tone: string; label: (a: number) => string }> = {
  POINTS: { icon: Coins, tone: "text-amber-600 dark:text-amber-400", label: (a) => `+${a} pts` },
  SWEEPSTAKES: { icon: Ticket, tone: "text-teal-600 dark:text-teal-400", label: (a) => `+${a} entries` },
  REV_SHARE: { icon: TrendingUp, tone: "text-emerald-600 dark:text-emerald-400", label: (a) => `+$${(a / 100).toFixed(2)}` },
  PERK: { icon: Gift, tone: "text-pink-600 dark:text-pink-400", label: (a) => `×${a} perk` },
};

export function RewardsView() {
  const { userId, isGuest, setMode } = usePolly();
  const { data: wallet, isLoading } = useWallet(userId);
  const { toast } = useToast();
  const tier = TIERS.find((t) => t.key === wallet?.tier) ?? TIERS[0];
  const next = TIERS.find((t) => t.key !== tier.key && t.minPoints > (wallet?.points ?? 0)) ?? null;
  const progress = next
    ? Math.min(100, ((wallet!.points - tier.minPoints) / (next.minPoints - tier.minPoints)) * 100)
    : 100;

  return (
    <div className="px-4 pb-6 pt-4">
      <h1 className="text-xl font-bold tracking-tight">Your earnings</h1>
      <p className="text-xs text-muted-foreground">
        Thought patterns you express anyway — sponsored polls pay for them. Not 100 surveys for $10.
      </p>

      {isGuest && wallet && wallet.unclaimedPoints > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5"
        >
          <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
            {wallet.unclaimedPoints} points on hold
          </p>
          <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-300/80">
            Guest mode: your earnings are held until you create an account. Members also get
            sweepstakes entries and revenue share.
          </p>
          <Button
            size="sm"
            className="mt-2.5 h-9 rounded-xl"
            onClick={() =>
              toast({
                title: "Account creation",
                description: "Supabase auth flow in production — the demo shows the member experience on sign-in.",
              })
            }
          >
            Claim my points <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        </motion.div>
      )}

      {/* balances */}
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {isLoading || !wallet ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : (
          [
            {
              label: "Points",
              value: wallet.points.toLocaleString(),
              icon: Coins,
              cls: "bg-amber-500/12 text-amber-700 dark:text-amber-400",
            },
            {
              label: "Entries",
              value: wallet.sweepstakesEntries.toLocaleString(),
              icon: Ticket,
              cls: "bg-teal-600/12 text-teal-700 dark:text-teal-400",
            },
            {
              label: "Rev share",
              value: `$${(wallet.revShareCents / 100).toFixed(2)}`,
              icon: TrendingUp,
              cls: "bg-emerald-600/12 text-emerald-700 dark:text-emerald-400",
            },
          ].map((b) => (
            <div key={b.label} className={`rounded-2xl p-3 ${b.cls}`}>
              <b.icon className="h-4 w-4" aria-hidden="true" />
              <p className="mt-1.5 text-lg font-bold leading-none tabular-nums">{b.value}</p>
              <p className="mt-1 text-[11px] font-medium opacity-80">{b.label}</p>
            </div>
          ))
        )}
      </div>

      {/* tier */}
      {wallet && (
        <div className="mt-4 rounded-3xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-bold">
              <span aria-hidden="true" className="text-xl">{tier.emoji}</span> {tier.label} tier
            </p>
            <Badge variant="secondary" className="text-[10px]">
              {next ? `${next.minPoints - wallet.points} pts to ${next.label}` : "top tier"}
            </Badge>
          </div>
          <Progress value={progress} className="mt-3 h-2.5" aria-label="Tier progress" />
          <ul className="mt-3 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
            {tier.perks.map((p) => (
              <li key={p} className="flex items-start gap-1.5">
                <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ladder */}
      <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        The flock ladder
      </h2>
      <div className="mt-2.5 space-y-2">
        {TIERS.map((t) => (
          <div
            key={t.key}
            className={`flex items-center gap-3 rounded-2xl border p-3 ${
              t.key === wallet?.tier
                ? "border-primary/50 bg-accent/60"
                : "border-border/60 bg-card/50"
            }`}
          >
            <span aria-hidden="true" className="text-xl">{t.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {t.label}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  {t.minPoints.toLocaleString()}+ pts
                </span>
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {t.pointsMultiplier}× points · {t.sweepstakesPerPoll} entries/poll ·{" "}
                {t.revSharePct}% rev share
              </p>
            </div>
            {t.key === wallet?.tier && <Badge className="shrink-0 text-[10px]">you</Badge>}
          </div>
        ))}
      </div>

      {/* history */}
      <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        Activity
      </h2>
      <div className="mt-2.5 space-y-1.5 pb-2">
        {isLoading || !wallet ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-2xl" />)
        ) : (
          wallet.transactions.map((t) => {
            const meta = KIND_META[t.kind] ?? KIND_META.POINTS;
            return (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/50 px-3.5 py-2.5"
              >
                <meta.icon className={`h-4 w-4 shrink-0 ${meta.tone}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium leading-snug">{t.memo}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <span className={`shrink-0 text-sm font-bold tabular-nums ${meta.tone}`}>
                  {meta.label(t.amount)}
                </span>
              </div>
            );
          })
        )}
      </div>

      <button
        onClick={() => setMode("sponsor")}
        className="mt-2 w-full rounded-2xl border border-dashed border-border py-2.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      >
        Are you a station, nonprofit, or brand? See the sponsor side →
      </button>
    </div>
  );
}
