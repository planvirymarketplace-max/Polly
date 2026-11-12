"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { TIERS } from "@/lib/polly/rewards";
import { useProfile } from "./hooks";
import { usePolly } from "./store";
import {
  Bell,
  Briefcase,
  Eye,
  LocateFixed,
  LogOut,
  MapPin,
  MessagesSquare,
  Scale,
  Users,
  Vote,
} from "lucide-react";

export function ProfileView() {
  const { userId, signOut, setMode } = usePolly();
  const { data: profile, isLoading } = useProfile(userId);
  const { toast } = useToast();
  const tier = TIERS.find((t) => t.key === profile?.tier) ?? TIERS[0];

  if (isLoading || !profile) {
    return (
      <div className="space-y-4 px-4 pt-6">
        <Skeleton className="h-20 w-20 rounded-full" />
        <Skeleton className="h-6 w-44 rounded-md" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 pt-5">
      {/* identity */}
      <div className="flex items-center gap-4">
        <div
          className="flex h-18 w-18 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-2xl font-bold text-primary-foreground"
          style={{ height: 72, width: 72 }}
          aria-hidden="true"
        >
          {profile.displayName.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight">{profile.displayName}</h1>
          <p className="text-sm text-muted-foreground">@{profile.handle}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge className="gap-1 text-[11px]">
              <span aria-hidden="true">{tier.emoji}</span> {tier.label}
            </Badge>
            {profile.metro && (
              <Badge variant="outline" className="gap-1 text-[11px]">
                <MapPin className="h-3 w-3" /> {profile.metro}
                {profile.stateCode ? `, ${profile.stateCode}` : ""}
              </Badge>
            )}
            {profile.accountType === "GUEST" && (
              <Badge variant="secondary" className="text-[11px]">
                guest — limited
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* stats */}
      <div className="mt-4 grid grid-cols-3 gap-2.5 text-center">
        {[
          { icon: Users, value: profile.followerCount.toLocaleString(), label: "followers" },
          { icon: Vote, value: String(profile.pollsAnswered), label: "polls answered" },
          { icon: MessagesSquare, value: String(profile.commentsPosted), label: "takes posted" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border/60 bg-card/60 p-3">
            <s.icon className="mx-auto h-4 w-4 text-primary" aria-hidden="true" />
            <p className="mt-1 text-lg font-bold leading-none tabular-nums">{s.value}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* transparency: the interest graph */}
      <section className="mt-5 rounded-3xl border border-border/70 bg-card p-4 shadow-sm">
        <h2 className="flex items-center gap-1.5 text-sm font-bold">
          <Eye className="h-4 w-4 text-primary" /> What Polly knows about you
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Your interest graph, inferred from what you engage with. It decides which polls select
          you — nothing hidden, nothing sold.
        </p>
        <div className="mt-3 space-y-2.5">
          {profile.interests.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nothing yet — comment in The Commons and the graph starts to form.
            </p>
          )}
          {profile.interests.map((i) => (
            <div key={i.topic.slug}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium">
                  <span aria-hidden="true">{i.topic.emoji}</span> {i.topic.label}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {Math.round(i.affinity * 100)}%
                </span>
              </div>
              <Progress
                value={i.affinity * 100}
                className="h-2"
                aria-label={`${i.topic.label} affinity`}
              />
            </div>
          ))}
        </div>
      </section>

      {/* quota profile */}
      <section className="mt-4 rounded-3xl border border-border/70 bg-card p-4 shadow-sm">
        <h2 className="flex items-center gap-1.5 text-sm font-bold">
          <Scale className="h-4 w-4 text-primary" /> Your quota cell
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Used to balance sponsored poll samples to census targets — this is what makes results
          publishable instead of skewed.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5 text-xs">
          <Badge variant="secondary">age: {profile.ageBracket ?? "not on file"}</Badge>
          <Badge variant="secondary">gender: {profile.genderBucket ?? "not on file"}</Badge>
          <Badge variant="secondary">metro: {profile.metro ?? "not on file"}</Badge>
        </div>
      </section>

      {/* settings */}
      <section className="mt-4 rounded-3xl border border-border/70 bg-card p-2 shadow-sm">
        {[
          { icon: Bell, label: "Poll invitations", desc: "Push + in-app when selected" },
          { icon: LocateFixed, label: "Local happenings", desc: "Use my metro for The Commons" },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-3 px-2.5 py-2.5">
            <s.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm font-medium leading-tight">{s.label}</p>
              <p className="text-[11px] text-muted-foreground">{s.desc}</p>
            </div>
            <Switch
              defaultChecked
              aria-label={s.label}
              onCheckedChange={() =>
                toast({ title: "Demo build", description: "Preferences persist in production." })
              }
            />
          </div>
        ))}
      </section>

      <div className="mt-5 space-y-2">
        <Button
          variant="outline"
          className="h-11 w-full gap-2 rounded-2xl"
          onClick={() => setMode("sponsor")}
        >
          <Briefcase className="h-4 w-4" /> View the sponsor dashboard
        </Button>
        <Button
          variant="ghost"
          className="h-11 w-full gap-2 rounded-2xl text-muted-foreground"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </div>
  );
}
