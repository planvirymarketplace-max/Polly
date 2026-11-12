"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { MODE_META } from "@/lib/polly/sampling";
import type { PollCardDTO, PollResults, VoteResultDTO } from "@/lib/polly/types";
import { usePollResults, useVote } from "./hooks";
import { usePolly } from "./store";
import {
  Coins,
  Eye,
  FlaskConical,
  HeartHandshake,
  Landmark,
  Scale,
  ShoppingCart,
  Target,
  Ticket,
  Trophy,
  Tv,
  Users,
  Vote,
} from "lucide-react";

const SPONSOR_ICONS: Record<string, typeof Tv> = {
  STATION: Tv,
  NONPROFIT: HeartHandshake,
  RESEARCH: FlaskConical,
  BRAND: ShoppingCart,
  ADVOCACY: Landmark,
};

const MODE_ICONS: Record<string, typeof Target> = {
  QUOTA_UGC: Scale,
  UGC_MATCH: Target,
  RANDOM: Users,
  SPONSOR_SEGMENT: Landmark,
};

function QuotaBars({ results }: { results: PollResults }) {
  return (
    <div className="rounded-2xl bg-muted/60 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Users className="h-3.5 w-3.5" /> Sample balance — age brackets vs census target
      </p>
      <div className="space-y-1.5">
        {results.quotaFill.map((q) => (
          <div key={q.cell} className="flex items-center gap-2 text-[11px]">
            <span className="w-12 shrink-0 text-muted-foreground">{q.cell}</span>
            <div className="relative h-3.5 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className="absolute inset-y-0 left-0 rounded-full border-r-2 border-dashed border-foreground/30 bg-primary/15"
                style={{ width: `${q.target * 100}%` }}
                title="Census target"
              />
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary/70"
                style={{ width: `${Math.min(q.sample * 100, 100)}%` }}
                title="Current sample"
              />
            </div>
            <span className="w-16 shrink-0 text-right text-muted-foreground">
              {Math.round(q.sample * 100)}% / {Math.round(q.target * 100)}%
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        Shaded region = census target share · solid bar = current sample. Under-filled cells get
        higher selection priority and higher result weight.
      </p>
    </div>
  );
}

function ResultsBody({
  results,
  myOptionId,
}: {
  results: PollResults;
  myOptionId?: string;
}) {
  const [weighted, setWeighted] = useState(true);

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          n = {results.n.toLocaleString()} · weighted n = {results.weightedN.toLocaleString()}
        </p>
        <button
          onClick={() => setWeighted((w) => !w)}
          className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground transition-colors hover:bg-secondary/70"
        >
          <Scale className="h-3 w-3" />
          {weighted ? "Weighted (census-aligned)" : "Raw"}
        </button>
      </div>

      <div className="space-y-2" role="list" aria-label="Poll results">
        {results.options.map((o) => {
          const pct = weighted ? o.weightedPct : o.rawPct;
          const isMine = o.id === myOptionId;
          const top = Math.max(...results.options.map((x) => (weighted ? x.weightedPct : x.rawPct)));
          return (
            <div key={o.id} className="relative">
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className={`leading-snug ${isMine ? "font-bold" : "font-medium"}`}>
                  {isMine && <Vote className="mr-1 inline h-3.5 w-3.5 text-primary" aria-label="Your pick" />}
                  {o.label}
                </span>
                <span className={`shrink-0 tabular-nums ${pct === top ? "font-bold text-primary" : ""}`}>
                  {pct.toFixed(1)}%
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  className={`h-full rounded-full ${pct === top ? "bg-primary" : "bg-primary/45"}`}
                />
              </div>
              {weighted && Math.abs(o.weightedPct - o.rawPct) >= 0.5 && (
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  raw {o.rawPct.toFixed(1)}% → weighted {o.weightedPct.toFixed(1)}%
                </p>
              )}
            </div>
          );
        })}
      </div>

      <QuotaBars results={results} />
    </div>
  );
}

function RewardSplash({ v }: { v: VoteResultDTO }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5"
    >
      <p className="flex items-center gap-1.5 text-sm font-bold text-amber-700 dark:text-amber-400">
        <Trophy className="h-4 w-4" /> You earned it
      </p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <Badge className="gap-1 bg-amber-500/20 text-amber-800 hover:bg-amber-500/20 dark:text-amber-300">
          <Coins className="h-3 w-3" /> +{v.awardedPoints} points{v.guestNotice ? " (held)" : ""}
        </Badge>
        {v.sweepstakesEntries > 0 && (
          <Badge className="gap-1 bg-teal-600/15 text-teal-800 hover:bg-teal-600/15 dark:text-teal-300">
            <Ticket className="h-3 w-3" /> +{v.sweepstakesEntries} sweepstakes entries
          </Badge>
        )}
        {v.revShareCents > 0 && (
          <Badge className="gap-1 bg-emerald-600/15 text-emerald-800 hover:bg-emerald-600/15 dark:text-emerald-300">
            <Coins className="h-3 w-3" /> +${(v.revShareCents / 100).toFixed(2)} revenue share
          </Badge>
        )}
        <Badge variant="outline" className="gap-1">
          <Scale className="h-3 w-3" /> your response counts ×{v.myWeight.toFixed(2)}
        </Badge>
      </div>
      {v.guestNotice && (
        <p className="mt-2 text-xs leading-relaxed text-amber-800/90 dark:text-amber-300/90">
          {v.guestNotice}
        </p>
      )}
    </motion.div>
  );
}

export function PollCard({ poll, index }: { poll: PollCardDTO; index: number }) {
  const { userId } = usePolly();
  const setSplashStore = usePolly((s) => s.setSplash);
  const splash = usePolly((s) => s.splashes[poll.id]);
  const vote = useVote(userId);
  const resultsQ = usePollResults(poll.alreadyResponded ? poll.id : null);
  const [selected, setSelected] = useState<string | null>(null);
  const { toast } = useToast();

  const SponsorIcon = SPONSOR_ICONS[poll.sponsor.kind] ?? Landmark;
  const ModeIcon = MODE_ICONS[poll.samplingMode] ?? Target;
  const mode = MODE_META[poll.samplingMode];

  const castVote = async () => {
    if (!selected) return;
    try {
      const res = await vote.mutateAsync({ pollId: poll.id, optionId: selected });
      setSplashStore(poll.id, res);
      setSelected(null);
    } catch (e) {
      toast({
        title: "Vote failed",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    }
  };

  const showResults = poll.alreadyResponded || Boolean(splash);
  const results = splash?.results ?? resultsQ.data?.results ?? null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.25), duration: 0.3 }}
      className="rounded-3xl border border-border/70 bg-card p-4 shadow-sm"
    >
      {/* sponsor row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
            <SponsorIcon className="h-4.5 w-4.5" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">{poll.sponsor.name}</p>
            <p className="text-[11px] text-muted-foreground">
              Sponsored poll · closes {formatDistanceToNow(new Date(poll.closesAt), { addSuffix: true })}
            </p>
          </div>
        </div>
        <Badge className="gap-1 bg-amber-500/20 text-amber-800 hover:bg-amber-500/20 dark:text-amber-300">
          <Coins className="h-3 w-3" /> +{poll.rewardPoints}
        </Badge>
      </div>

      <h2 className="mt-3 text-[17px] font-semibold leading-snug">{poll.question}</h2>
      {poll.context && (
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{poll.context}</p>
      )}

      {/* why you — the transparency layer */}
      {poll.explanation && (
        <div className="mt-3 rounded-2xl bg-accent/70 p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-accent-foreground">
            <Eye className="h-3.5 w-3.5" /> Why you were selected
          </p>
          <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-accent-foreground/90">
            {poll.explanation.reasons.map((r, i) => (
              <li key={i} className="flex gap-1.5">
                <span aria-hidden="true" className="text-accent-foreground/50">›</span>
                {r}
              </li>
            ))}
          </ul>
          <Badge variant="outline" className="mt-2 gap-1 border-accent-foreground/25 text-[10px] font-medium text-accent-foreground">
            <ModeIcon className="h-3 w-3" /> {mode.label} · {mode.perCompleteCents / 100 > 0 ? `$${(MODE_META[poll.samplingMode].perCompleteCents / 100).toFixed(2)}` : ""} per complete
          </Badge>
        </div>
      )}

      {/* options / results */}
      <AnimatePresence mode="wait">
        {!showResults ? (
          <motion.div key="options" exit={{ opacity: 0 }} className="mt-3.5 space-y-2">
            {poll.options.map((o) => {
              const active = selected === o.id;
              return (
                <button
                  key={o.id}
                  onClick={() => setSelected(o.id)}
                  aria-pressed={active}
                  className={`min-h-[44px] w-full rounded-2xl border-2 px-3.5 py-2.5 text-left text-sm font-medium transition-all ${
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/70 bg-background hover:border-primary/40 hover:bg-accent/40"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
            <Button
              className="mt-1 h-11 w-full rounded-2xl text-[15px] font-semibold"
              disabled={!selected || vote.isPending}
              onClick={castVote}
            >
              {vote.isPending ? "Counting…" : "Weigh in"}
            </Button>
          </motion.div>
        ) : (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {splash && <RewardSplash v={splash} />}
            {results ? (
              <ResultsBody results={results} myOptionId={poll.myOptionId ?? undefined} />
            ) : (
              <div className="mt-3 space-y-3">
                <Skeleton className="h-4 w-40 rounded-md" />
                <Skeleton className="h-8 w-full rounded-xl" />
                <Skeleton className="h-8 w-full rounded-xl" />
                <Skeleton className="h-8 w-full rounded-xl" />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
