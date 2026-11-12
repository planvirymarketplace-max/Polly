"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { MODE_META } from "@/lib/polly/sampling";
import type { PriceEstimateDTO, SamplingMode } from "@/lib/polly/types";
import {
  useCreateSponsorPoll,
  useEstimate,
  useSponsorPolls,
  type SponsorPollRow,
} from "./hooks";
import { usePolly } from "./store";
import { PollyLogo } from "./PollyLogo";
import {
  ArrowLeft,
  BadgeDollarSign,
  CheckCircle2,
  FlaskConical,
  HeartHandshake,
  Landmark,
  Mic,
  Plus,
  Rocket,
  Scale,
  ShoppingCart,
  Target,
  Trash2,
  TrendingDown,
  Tv,
  Users,
} from "lucide-react";

const METROS = [
  "Chicago",
  "Columbus",
  "Cleveland",
  "Cincinnati",
  "Phoenix",
  "Detroit",
  "Atlanta",
  "Denver",
  "Houston",
  "Seattle",
];

const MODES: SamplingMode[] = ["QUOTA_UGC", "UGC_MATCH", "RANDOM", "SPONSOR_SEGMENT", "CREATOR"];
const MODE_ICONS: Record<SamplingMode, typeof Target> = {
  QUOTA_UGC: Scale,
  UGC_MATCH: Target,
  RANDOM: Users,
  SPONSOR_SEGMENT: Landmark,
  CREATOR: Mic,
};

function money(cents: number) {
  return cents >= 100000
    ? `$${(cents / 100000).toFixed(1)}k`
    : `$${(cents / 100).toFixed(2)}`;
}

function ThesisStrip() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-primary/25 bg-accent/60 px-5 py-3.5 text-sm">
      <span className="flex items-center gap-2 font-semibold text-accent-foreground">
        <TrendingDown className="h-4 w-4" /> The thesis: drive down the cost of knowing what people think
      </span>
      <span className="text-muted-foreground">
        Telephone poll, n=500: <b className="text-foreground">$12.5k–$25k</b>
      </span>
      <span className="text-muted-foreground">
        Polly, n=500: <b className="text-primary">$750</b>
      </span>
      <Badge className="bg-emerald-600/15 text-emerald-700 hover:bg-emerald-600/15 dark:text-emerald-400">
        ~94% lower
      </Badge>
    </div>
  );
}

function Composer() {
  const { data: meta } = useQuery({
    queryKey: ["meta"],
    queryFn: async () => {
      const res = await fetch("/api/meta");
      if (!res.ok) throw new Error("Meta failed");
      return res.json();
    },
  });

  const [sponsorId, setSponsorId] = useState<string>("");
  const [creatorId, setCreatorId] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  const [topicId, setTopicId] = useState<string>("");
  const [mode, setMode] = useState<SamplingMode>("QUOTA_UGC");
  const [metros, setMetros] = useState<string[]>([]);
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [rewardPoints, setRewardPoints] = useState(50);
  const [estimatedN, setEstimatedN] = useState(500);

  const create = useCreateSponsorPoll();
  const { toast } = useToast();

  const metrosParam = metros.length === 0 ? "" : metros.join(",");
  const estimate = useEstimate({ completes: estimatedN, mode, metros: metrosParam, enabled: true });
  const est = estimate.data as PriceEstimateDTO | undefined;

  const savings = useMemo(() => {
    if (!est) return null;
    const mid = (est.traditionalLowCents + est.traditionalHighCents) / 2;
    return Math.max(0, Math.round((1 - est.totalCents / mid) * 100));
  }, [est]);

  const toggleMetro = (m: string) =>
    setMetros((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const launch = async () => {
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!sponsorId || !topicId || question.trim().length < 8 || cleanOptions.length < 2) {
      toast({
        title: "Almost there",
        description: "Pick a sponsor and topic, write the question, and add at least two options.",
        variant: "destructive",
      });
      return;
    }
    if (mode === "CREATOR" && !creatorId) {
      toast({
        title: "Pick a creator channel",
        description: "Creator Audience polls run through a specific creator — choose who delivers it.",
        variant: "destructive",
      });
      return;
    }
    try {
      await create.mutateAsync({
        sponsorId,
        question: question.trim(),
        context: context.trim(),
        topicId,
        samplingMode: mode,
        creatorId: mode === "CREATOR" ? creatorId : undefined,
        targetMetros: metros,
        rewardPoints,
        estimatedN,
        options: cleanOptions,
        closesInDays: 7,
      });
      toast({
        title: "Poll is live",
        description: "It's already in the member app — matched users are being selected now.",
      });
      setQuestion("");
      setContext("");
      setOptions(["", ""]);
      setCreatorId("");
    } catch (e) {
      toast({
        title: "Launch failed",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <BadgeDollarSign className="h-5 w-5 text-primary" /> Compose a poll
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Stations, nonprofits, research, brands, advocacy — anyone who needs real data, not clicks.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sp-sponsor">Sponsor</Label>
          <Select value={sponsorId} onValueChange={setSponsorId}>
            <SelectTrigger id="sp-sponsor" className="w-full">
              <SelectValue placeholder="Choose identity" />
            </SelectTrigger>
            <SelectContent>
              {(meta?.sponsors ?? []).map((s: { id: string; name: string; kind: string }) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} · {s.kind.toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sp-topic">Topic</Label>
          <Select value={topicId} onValueChange={setTopicId}>
            <SelectTrigger id="sp-topic" className="w-full">
              <SelectValue placeholder="What's it about?" />
            </SelectTrigger>
            <SelectContent>
              {(meta?.topics ?? []).map((t: { id: string; label: string; emoji: string | null }) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.emoji} {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="sp-question">Question</Label>
        <Input
          id="sp-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Should the city fund 24-hour transit in shift-worker zones?"
          className="text-base"
        />
      </div>

      <div className="mt-3 space-y-1.5">
        <Label htmlFor="sp-context">Context shown to users (optional)</Label>
        <Input
          id="sp-context"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Results air in our evening series and go to the transit board."
        />
      </div>

      {/* sampling mode */}
      <div className="mt-4">
        <Label>Sampling engine</Label>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
          {MODES.map((m) => {
            const Icon = MODE_ICONS[m];
            const active = mode === m;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                aria-pressed={active}
                className={`rounded-2xl border-2 p-3 text-left transition-all ${
                  active ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/40"
                }`}
              >
                <p className="flex items-center justify-between text-sm font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Icon className="h-4 w-4 text-primary" /> {MODE_META[m].label}
                  </span>
                  <span className="text-xs font-bold text-primary">
                    ${MODE_META[m].perCompleteCents / 100}
                  </span>
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {MODE_META[m].blurb}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* creator channel — CREATOR mode only */}
      {mode === "CREATOR" && (
        <div className="mt-4 space-y-1.5 rounded-2xl border border-primary/25 bg-accent/50 p-3.5">
          <Label htmlFor="sp-creator">Creator channel</Label>
          <Select value={creatorId} onValueChange={setCreatorId}>
            <SelectTrigger id="sp-creator" className="w-full bg-card">
              <SelectValue placeholder="Who delivers this to their audience?" />
            </SelectTrigger>
            <SelectContent>
              {(
                (meta?.creators ?? []) as {
                  id: string;
                  handle: string;
                  displayName: string;
                  followerCount: number;
                }[]
              ).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  @{c.handle} · {c.displayName} · {c.followerCount.toLocaleString()} followers
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            The poll lands in every follower's feed under the creator's name with a transparent
            "delivered through" note — and the creator earns revenue share on each complete.
          </p>
        </div>
      )}

      {/* geography */}
      <div className="mt-4">
        <Label>
          Geography{" "}
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            (none selected = national)
          </span>
        </Label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {METROS.map((m) => (
            <button
              key={m}
              onClick={() => toggleMetro(m)}
              aria-pressed={metros.includes(m)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                metros.includes(m)
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/70"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* options */}
      <div className="mt-4 space-y-2">
        <Label>Options</Label>
        {options.map((o, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={o}
              onChange={(e) =>
                setOptions((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
              }
              placeholder={`Option ${i + 1}`}
              aria-label={`Option ${i + 1}`}
            />
            {options.length > 2 && (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground"
                onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                aria-label={`Remove option ${i + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        {options.length < 8 && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => setOptions((prev) => [...prev, ""])}
          >
            <Plus className="h-3.5 w-3.5" /> Add option
          </Button>
        )}
      </div>

      {/* sliders */}
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="sp-reward">User reward</Label>
            <span className="text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {rewardPoints} pts
            </span>
          </div>
          <Slider
            id="sp-reward"
            value={[rewardPoints]}
            onValueChange={([v]) => setRewardPoints(v)}
            min={20}
            max={500}
            step={5}
            className="mt-2"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="sp-n">Target completes</Label>
            <span className="text-sm font-bold tabular-nums">n={estimatedN.toLocaleString()}</span>
          </div>
          <Slider
            id="sp-n"
            value={[estimatedN]}
            onValueChange={([v]) => setEstimatedN(v)}
            min={100}
            max={5000}
            step={100}
            className="mt-2"
          />
        </div>
      </div>

      {/* estimate */}
      {est && (
        <div className="mt-5 rounded-2xl border border-primary/25 bg-accent/50 p-4">
          <p className="text-sm font-bold text-accent-foreground">Live estimate</p>
          <div className="mt-2.5 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-4">
            <div>
              <p className="text-[11px] text-muted-foreground">Polly</p>
              <p className="text-lg font-bold text-primary tabular-nums">{money(est.totalCents)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Telephone</p>
              <p className="text-lg font-bold tabular-nums">
                {money(est.traditionalLowCents)}–{money(est.traditionalHighCents)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Savings</p>
              <p className="text-lg font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                ~{savings}%
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Field time</p>
              <p className="text-lg font-bold tabular-nums">
                {est.fieldDays}d <span className="text-xs font-normal text-muted-foreground">vs {est.traditionalFieldDays}d</span>
              </p>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            {money(est.perCompleteCents)}/complete · demo figures · quota+UGC results arrive census-weighted with published methodology
          </p>
        </div>
      )}

      <Button
        className="mt-4 h-12 w-full gap-2 rounded-2xl text-[15px] font-semibold"
        onClick={launch}
        disabled={create.isPending}
      >
        <Rocket className="h-4.5 w-4.5" />
        {create.isPending ? "Launching…" : "Launch poll"}
      </Button>
    </div>
  );
}

function SponsorPollItem({ p }: { p: SponsorPollRow }) {
  const [open, setOpen] = useState(false);
  const fill = Math.min(100, (p.actualN / Math.max(p.estimatedN, 1)) * 100);
  const top = p.results.options.reduce(
    (best, o) => (o.weightedPct > (best?.weightedPct ?? -1) ? o : best),
    p.results.options[0]
  );

  return (
    <motion.div layout className="rounded-3xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary" className="gap-1">
          {p.topic?.emoji} {p.topic?.label}
        </Badge>
        <Badge variant="outline" className="gap-1">
          {MODE_META[p.samplingMode as SamplingMode].label}
        </Badge>
        {p.creatorHandle && (
          <Badge variant="outline" className="gap-1">
            <Mic className="h-3 w-3" /> via @{p.creatorHandle}
          </Badge>
        )}
        <Badge
          variant={p.status === "LIVE" ? "default" : "secondary"}
          className={
            p.status === "LIVE"
              ? "gap-1 bg-emerald-600 text-white hover:bg-emerald-600"
              : "gap-1"
          }
        >
          <CheckCircle2 className="h-3 w-3" /> {p.status.toLowerCase()}
        </Badge>
        <span className="ml-auto">{p.sponsor}</span>
      </div>

      <p className="mt-2.5 font-semibold leading-snug">{p.question}</p>

      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-[11px] text-muted-foreground">Completes</p>
          <p className="font-bold tabular-nums">
            {p.actualN.toLocaleString()}
            <span className="text-xs font-normal text-muted-foreground">
              {" "}/ {p.estimatedN.toLocaleString()}
            </span>
          </p>
          <Progress value={fill} className="mt-1 h-1.5" aria-label="Completes progress" />
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">Spend</p>
          <p className="font-bold tabular-nums">{money(p.spendCents)}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">Leader (weighted)</p>
          <p className="truncate font-bold text-primary">
            {top ? `${top.weightedPct.toFixed(1)}% — ${top.label}` : "—"}
          </p>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="mt-2.5 h-8 gap-1.5 rounded-xl px-2.5 text-xs text-muted-foreground"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Hide" : "View"} weighted crosstabs
      </Button>

      {open && (
        <div className="mt-2 space-y-2 border-l-2 border-primary/25 pl-3">
          <p className="text-[11px] text-muted-foreground">
            n = {p.results.n.toLocaleString()} · weighted n = {p.results.weightedN.toLocaleString()} · closes{" "}
            {formatDistanceToNow(new Date(p.closesAt), { addSuffix: true })}
          </p>
          {p.results.options.map((o) => (
            <div key={o.id}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate">{o.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  raw {o.rawPct.toFixed(1)}% → <b className="text-foreground">weighted {o.weightedPct.toFixed(1)}%</b>
                </span>
              </div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${o.weightedPct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export function SponsorView() {
  const { setMode } = usePolly();
  const { data, isLoading } = useSponsorPolls();
  const polls = data?.polls ?? [];
  const totalSpend = polls.reduce((s, p) => s + p.spendCents, 0);
  const totalCompletes = polls.reduce((s, p) => s + p.actualN, 0);

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setMode("app")}>
              <ArrowLeft className="h-4 w-4" /> Back to app
            </Button>
            <Separator orientation="vertical" className="hidden h-6 sm:block" />
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-primary">
                <PollyLogo size={26} />
              </span>
              <span className="font-bold">Polly for Sponsors</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="hidden sm:inline">
              {totalCompletes.toLocaleString()} completes · {money(totalSpend)} lifetime spend
            </span>
            <Badge variant="secondary">demo console</Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6" role="main">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Anyone who needs to know what people think — at a price that finally makes sense
          </h1>
          <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">
            Stations, nonprofits, research firms, brands, advocacy groups. Buy answers from a
            self-selected, engaged audience — balanced, weighted, publishable. No call centers, no
            $5 bills in the mail, no random-website sweepstakes.
          </p>
        </div>

        <ThesisStrip />

        <div className="grid gap-6 lg:grid-cols-2">
          <Composer />

          <div>
            <h2 className="mb-2.5 flex items-center gap-2 text-lg font-bold">
              <FlaskConical className="h-5 w-5 text-primary" /> Field & results
            </h2>
            <div className="space-y-3">
              {isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-36 rounded-3xl" />
                ))}
              {polls.map((p) => (
                <SponsorPollItem key={p.id} p={p} />
              ))}
            </div>
          </div>
        </div>

        <p className="pb-6 text-center text-xs text-muted-foreground">
          Production: Supabase + row-level security per sponsor · billing via Stripe · EAS Update
          pushes question changes without store review
        </p>
      </main>
    </div>
  );
}
