"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { PollCardDTO } from "@/lib/polly/types";
import { usePolls, usePollResults } from "./hooks";
import { PollCard } from "./PollCard";
import { usePolly } from "./store";
import { History, Scale, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function ClosedCard({ poll }: { poll: PollCardDTO }) {
  const { data } = usePollResults(poll.id);
  const top = data?.results.options.reduce(
    (best, o) => ((o.weightedPct ?? 0) > (best?.weightedPct ?? -1) ? o : best),
    data?.results.options[0]
  );

  return (
    <div className="rounded-3xl border border-border/70 bg-card/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug">{poll.question}</p>
        <Badge variant="outline" className="shrink-0 text-[10px]">
          closed
        </Badge>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {poll.sponsor.name} · {poll.topic?.label} ·{" "}
        {formatDistanceToNow(new Date(poll.closesAt), { addSuffix: true })}
      </p>
      {top && (
        <p className="mt-2.5 flex items-center gap-1.5 text-sm">
          <Scale className="h-4 w-4 text-primary" />
          <span className="font-bold text-primary">{top.weightedPct.toFixed(1)}%</span>
          <span className="text-muted-foreground">— {top.label}</span>
        </p>
      )}
      <p className="mt-1 text-[10px] text-muted-foreground">
        Weighted to census targets · methodology published with release
      </p>
    </div>
  );
}

export function PollsView() {
  const { userId } = usePolly();
  const { data, isLoading } = usePolls(userId);
  const live = data?.live ?? [];
  const open = live.filter((p) => !p.alreadyResponded);
  const answered = live.filter((p) => p.alreadyResponded);

  return (
    <div className="px-4 pb-6 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Selected for you</h1>
          <p className="text-xs text-muted-foreground">
            Sponsors pay to hear from people who engage. You always see why you were picked — and
            you always earn.
          </p>
        </div>
        <Badge variant="secondary" className="gap-1 whitespace-nowrap text-[10px]">
          <Sparkles className="h-3 w-3" /> no community polls
        </Badge>
      </div>

      <div className="mt-4 space-y-4">
        {isLoading &&
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-3xl border border-border/70 bg-card p-4">
              <Skeleton className="h-9 w-48 rounded-xl" />
              <Skeleton className="h-5 w-full rounded-md" />
              <Skeleton className="h-14 w-full rounded-2xl" />
              <Skeleton className="h-11 w-full rounded-2xl" />
            </div>
          ))}

        {open.map((p, i) => (
          <PollCard key={p.id} poll={p} index={i} />
        ))}

        {answered.length > 0 && (
          <>
            <h2 className="pt-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Your responses — live results
            </h2>
            {answered.map((p, i) => (
              <PollCard key={p.id} poll={p} index={i} />
            ))}
          </>
        )}

        {(data?.closed ?? []).length > 0 && (
          <>
            <h2 className="flex items-center gap-1.5 pt-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              <History className="h-4 w-4" /> Recently closed
            </h2>
            {(data?.closed ?? []).map((p) => (
              <ClosedCard key={p.id} poll={p} />
            ))}
          </>
        )}

        {!isLoading && open.length === 0 && answered.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No polls selected for you right now. Keep engaging with The Commons — the system
            matches polls to what you care about.
          </p>
        )}
      </div>
    </div>
  );
}
