"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { TIERS } from "@/lib/polly/rewards";
import type { HappeningDTO } from "@/lib/polly/types";
import { useComment, useHappenings } from "./hooks";
import { usePolly } from "./store";
import {
  ChevronDown,
  ExternalLink,
  Flame,
  Globe,
  MapPin,
  MessageSquare,
  Send,
} from "lucide-react";

function tierBadge(tier: string) {
  return TIERS.find((t) => t.key === tier)?.emoji ?? "🐣";
}

function CommentComposer({ happeningId }: { happeningId: string }) {
  const [body, setBody] = useState("");
  const { userId } = usePolly();
  const comment = useComment(userId);
  const { toast } = useToast();

  const post = async () => {
    if (!body.trim()) return;
    try {
      await comment.mutateAsync({ happeningId, body });
      setBody("");
      toast({ title: "Posted", description: "Your take is live in The Commons." });
    } catch (e) {
      toast({
        title: "Couldn't post",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="mt-3 flex gap-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add your take…"
        className="min-h-[44px] resize-none rounded-2xl text-sm"
        rows={1}
        maxLength={500}
        aria-label="Write a comment"
      />
      <Button
        size="icon"
        className="h-11 w-11 shrink-0 rounded-2xl"
        disabled={!body.trim() || comment.isPending}
        onClick={post}
        aria-label="Post comment"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}

function HappeningCard({ h, index }: { h: HappeningDTO; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3), duration: 0.3 }}
      className="rounded-3xl border border-border/70 bg-card p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {h.topic && (
          <Badge variant="secondary" className="gap-1">
            <span aria-hidden="true">{h.topic.emoji}</span> {h.topic.label}
          </Badge>
        )}
        {h.metro ? (
          <Badge variant="outline" className="gap-1">
            <MapPin className="h-3 w-3" /> {h.metro}, {h.stateCode}
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1">
            <Globe className="h-3 w-3" /> National
          </Badge>
        )}
        <span className="ml-auto flex items-center gap-1 text-amber-600 dark:text-amber-500" title="Engagement heat">
          <Flame className="h-3.5 w-3.5" /> {h.hotness.toLocaleString()}
        </span>
      </div>

      <h2 className="mt-2.5 text-[17px] font-semibold leading-snug">{h.title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{h.summary}</p>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>
          {h.sourceName} · {formatDistanceToNow(new Date(h.createdAt), { addSuffix: true })}
        </span>
        {h.sourceUrl && (
          <a
            href={h.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            Read at {h.sourceName} <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </p>

      <Collapsible open={open} onOpenChange={setOpen} className="mt-1">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="mt-1 gap-1.5 rounded-xl px-2.5 text-muted-foreground">
            <MessageSquare className="h-4 w-4" />
            {h.commentCount} {h.commentCount === 1 ? "take" : "takes"}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 space-y-2.5 border-l-2 border-primary/20 pl-3">
            {h.comments.map((c) => (
              <div key={c.id} className="text-sm">
                <p className="flex items-center gap-1.5 text-xs font-medium">
                  <span aria-hidden="true">{tierBadge(c.author.tier)}</span>
                  {c.author.displayName}
                  <span className="font-normal text-muted-foreground">
                    · {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                  </span>
                </p>
                <p className="mt-0.5 leading-relaxed text-foreground/90">{c.body}</p>
              </div>
            ))}
            <CommentComposer happeningId={h.id} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </motion.article>
  );
}

export function FeedView() {
  const { data, isLoading } = useHappenings();
  const [topic, setTopic] = useState<string | null>(null);

  const topics = useMemo(() => {
    const set = new Map<string, { label: string; emoji: string | null }>();
    for (const h of data?.happenings ?? []) {
      if (h.topic) set.set(h.topic.slug, { label: h.topic.label, emoji: h.topic.emoji });
    }
    return [...set.entries()];
  }, [data]);

  const filtered = useMemo(() => {
    let list = data?.happenings ?? [];
    if (topic) list = list.filter((h) => h.topic?.slug === topic);
    return list;
  }, [data, topic]);

  return (
    <div className="px-4 pb-6 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">The Commons</h1>
          <p className="text-xs text-muted-foreground">
            What's happening where it matters — comment, and the system learns what you care about.
          </p>
        </div>
      </div>

      {topics.length > 0 && (
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setTopic(null)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              topic === null ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            All
          </button>
          {topics.map(([slug, t]) => (
            <button
              key={slug}
              onClick={() => setTopic(slug)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                topic === slug ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              <span aria-hidden="true">{t.emoji}</span> {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-4">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-3xl border border-border/70 bg-card p-4">
              <Skeleton className="h-4 w-24 rounded-full" />
              <Skeleton className="h-5 w-full rounded-md" />
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-2/3 rounded-md" />
            </div>
          ))}
        {filtered.map((h, i) => (
          <HappeningCard key={h.id} h={h} index={i} />
        ))}
        {!isLoading && filtered.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {topic
              ? "Nothing in this topic yet."
              : "No happenings yet — check back after the next news ingest."}
          </p>
        )}
      </div>
    </div>
  );
}
