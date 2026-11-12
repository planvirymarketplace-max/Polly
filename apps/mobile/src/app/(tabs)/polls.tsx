import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  api,
  isAuthRequiredError,
  type PollCardDTO,
  type PollResults,
  type VoteResultDTO,
} from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { EmptyCard, ErrorCard, SignInPrompt } from "../../components/States";

// Polls are sponsor-only: there is deliberately no poll-creation UI here.
// The feed is user-driven; polls come from sponsors via /api/polls.

const CORAL = "#d94f3d";
const SPONSOR_EMOJI: Record<string, string> = {
  STATION: "📺",
  NONPROFIT: "🤝",
  RESEARCH: "🔬",
  BRAND: "🛒",
  ADVOCACY: "🏛️",
  CREATOR: "🎙️",
};
const MODE_LABEL: Record<string, string> = {
  QUOTA_UGC: "Quota + UGC",
  UGC_MATCH: "UGC Match",
  RANDOM: "Random Draw",
  SPONSOR_SEGMENT: "Sponsor Segment",
  CREATOR: "Creator Audience",
};

function ResultsBars({ results, myOptionId }: { results: PollResults; myOptionId?: string }) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={s.resultsHead}>
        Results · {results.n} {results.n === 1 ? "response" : "responses"} · weighted n{" "}
        {results.weightedN.toFixed(1)}
      </Text>
      {results.options.map((o) => (
        <View key={o.id} style={{ marginTop: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={s.resultLabel}>
              {o.label}
              {myOptionId === o.id ? "  ✓ your pick" : ""}
            </Text>
            <Text style={s.resultPct}>{o.weightedPct.toFixed(1)}% weighted</Text>
          </View>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${Math.min(100, Math.max(0, o.weightedPct))}%` }]} />
          </View>
          <Text style={s.resultRaw}>
            Raw: {o.rawPct.toFixed(1)}% ({o.rawCount} {o.rawCount === 1 ? "vote" : "votes"})
          </Text>
        </View>
      ))}
      <Text style={s.methodNote}>
        Weighted results are post-stratified to census targets; raw results are the unadjusted
        sample. That's the methodology sponsors pay for.
      </Text>
    </View>
  );
}

export default function PollsScreen() {
  const { status, isLocalGuest } = useAuth();
  const authed = status === "signed-in" || (status === "guest" && !isLocalGuest);
  const [polls, setPolls] = useState<PollCardDTO[]>([]);
  const [closed, setClosed] = useState<PollCardDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [voting, setVoting] = useState<Record<string, boolean>>({});
  const [voteError, setVoteError] = useState<Record<string, string>>({});
  const [voteResults, setVoteResults] = useState<Record<string, VoteResultDTO>>({});
  const [fetchedResults, setFetchedResults] = useState<Record<string, PollResults>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNeedsAuth(false);
    try {
      const d = await api.polls();
      setPolls(d.live ?? []);
      setClosed(d.closed ?? []);
    } catch (e) {
      if (isAuthRequiredError(e)) {
        setNeedsAuth(true);
        setPolls([]);
        setClosed([]);
      } else {
        setError(e instanceof Error ? e.message : "Could not load polls.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) void load();
    else setLoading(false);
  }, [authed, load]);

  // Fetch weighted results for polls already answered + closed polls.
  useEffect(() => {
    const targets = [...polls.filter((p) => p.alreadyResponded), ...closed].filter(
      (p) => !fetchedResults[p.id] && !voteResults[p.id],
    );
    if (targets.length === 0) return;
    void Promise.all(
      targets.map(async (p) => {
        try {
          const { results } = await api.results(p.id);
          setFetchedResults((prev) => ({ ...prev, [p.id]: results }));
        } catch {
          // Results stay hidden for this poll; voting itself still works.
        }
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polls, closed]);

  const vote = async (pollId: string) => {
    const optionId = selected[pollId];
    if (!optionId || voting[pollId]) return;
    setVoting((prev) => ({ ...prev, [pollId]: true }));
    setVoteError((prev) => ({ ...prev, [pollId]: "" }));
    try {
      const result = await api.vote(pollId, optionId);
      setVoteResults((prev) => ({ ...prev, [pollId]: result }));
      setPolls((prev) =>
        prev.map((p) =>
          p.id === pollId ? { ...p, alreadyResponded: true, myOptionId: optionId } : p,
        ),
      );
    } catch (e) {
      if (isAuthRequiredError(e)) setNeedsAuth(true);
      setVoteError((prev) => ({
        ...prev,
        [pollId]: e instanceof Error ? e.message : "Vote failed.",
      }));
    } finally {
      setVoting((prev) => ({ ...prev, [pollId]: false }));
    }
  };

  const renderPoll = (p: PollCardDTO) => {
    const answered = p.alreadyResponded || Boolean(voteResults[p.id]);
    const results = voteResults[p.id]?.results ?? fetchedResults[p.id];
    const guestNotice = voteResults[p.id]?.guestNotice;
    return (
      <View key={p.id} style={s.card}>
        <View style={s.sponsorRow}>
          <View style={s.sponsorIcon}>
            <Text style={{ fontSize: 14 }}>{SPONSOR_EMOJI[p.sponsor.kind] ?? "🏛️"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.sponsorName}>{p.sponsor.name}</Text>
            <Text style={s.sponsorSub}>Sponsored poll</Text>
          </View>
          <Text style={s.reward}>+{p.rewardPoints} pts</Text>
        </View>

        <Text style={s.question}>{p.question}</Text>
        {p.context ? <Text style={s.context}>{p.context}</Text> : null}

        {p.explanation && (
          <View style={s.why}>
            <Text style={s.whyHead}>👁 Why you were selected</Text>
            <Text style={s.whyHeadline}>{p.explanation.headline}</Text>
            {p.explanation.reasons.map((r, i) => (
              <Text key={i} style={s.whyReason}>
                › {r}
              </Text>
            ))}
            {p.explanation.quotaCell ? (
              <Text style={s.whyReason}>Quota cell: {p.explanation.quotaCell}</Text>
            ) : null}
            <Text style={s.modeTag}>{MODE_LABEL[p.samplingMode] ?? p.samplingMode}</Text>
          </View>
        )}

        {p.options.map((o) => {
          const disabled = answered;
          const isMine = p.myOptionId === o.id || selected[p.id] === o.id;
          return (
            <Pressable
              key={o.id}
              disabled={disabled}
              onPress={() => setSelected((prev) => ({ ...prev, [p.id]: o.id }))}
              style={[
                s.option,
                isMine && { borderColor: CORAL, backgroundColor: "#fdeae5" },
                disabled && { opacity: 0.6 },
              ]}
            >
              <Text style={s.optionLabel}>{o.label}</Text>
            </Pressable>
          );
        })}

        {voteError[p.id] ? <Text style={s.voteError}>{voteError[p.id]}</Text> : null}

        {!answered && (
          <Pressable
            onPress={() => void vote(p.id)}
            disabled={!selected[p.id] || voting[p.id]}
            style={[s.voteBtn, (!selected[p.id] || voting[p.id]) && { opacity: 0.4 }]}
          >
            <Text style={s.voteBtnText}>{voting[p.id] ? "Weighing in…" : "Weigh in"}</Text>
          </Pressable>
        )}
        {answered && (
          <Text style={s.answered}>✓ You responded — voting is closed for you on this poll.</Text>
        )}
        {voteResults[p.id] ? (
          <View style={s.awardBox}>
            <Text style={s.awardText}>
              +{voteResults[p.id].awardedPoints} points
              {voteResults[p.id].sweepstakesEntries > 0
                ? ` · +${voteResults[p.id].sweepstakesEntries} sweepstakes entries`
                : ""}
              {voteResults[p.id].revShareCents > 0
                ? ` · +$${(voteResults[p.id].revShareCents / 100).toFixed(2)} rev share`
                : ""}
              {" · "}your response weight: {voteResults[p.id].myWeight.toFixed(2)}
            </Text>
            {guestNotice ? <Text style={s.guestNotice}>{guestNotice}</Text> : null}
          </View>
        ) : null}
        {results ? <ResultsBars results={results} myOptionId={p.myOptionId} /> : null}
      </View>
    );
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={s.h1}>Selected for you</Text>
      <Text style={s.sub}>
        Sponsors pay to hear from people who engage. You always see why you were picked.
      </Text>
      {loading ? (
        <ActivityIndicator color={CORAL} style={{ marginTop: 48 }} />
      ) : !authed || needsAuth ? (
        <SignInPrompt body="Polls are matched to signed-in members. Sign in to see the polls sponsors selected you for — and why." />
      ) : error ? (
        <ErrorCard message={error} onRetry={() => void load()} />
      ) : polls.length === 0 && closed.length === 0 ? (
        <EmptyCard
          title="No polls for you right now"
          body="No sponsor has selected you for a live poll yet. Keep commenting in the Commons — that's what gets you matched."
        />
      ) : (
        <>
          {polls.map(renderPoll)}
          {closed.length > 0 ? (
            <>
              <Text style={s.sectionHead}>Recently closed</Text>
              {closed.map(renderPoll)}
            </>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fbf6ee" },
  h1: { fontSize: 24, fontWeight: "800", color: "#2b2118" },
  sub: { fontSize: 13, color: "#8a7a6a", marginTop: 4, marginBottom: 16 },
  sectionHead: { fontSize: 16, fontWeight: "800", color: "#2b2118", marginTop: 8, marginBottom: 10 },
  card: {
    backgroundColor: "#fffdf9",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#eee5d8",
    padding: 16,
    marginBottom: 12,
  },
  sponsorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sponsorIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#f3ece1",
    alignItems: "center",
    justifyContent: "center",
  },
  sponsorName: { fontSize: 14, fontWeight: "700", color: "#2b2118" },
  sponsorSub: { fontSize: 11, color: "#a3968a" },
  reward: { color: "#b45309", fontWeight: "800", fontSize: 13 },
  question: { fontSize: 16, fontWeight: "700", color: "#2b2118", marginTop: 10, lineHeight: 22 },
  context: { fontSize: 13, color: "#6b5d4e", marginTop: 4, lineHeight: 19 },
  why: { backgroundColor: "#fbe9e2", borderRadius: 16, padding: 12, marginTop: 10 },
  whyHead: { fontSize: 12, fontWeight: "800", color: "#a3402f" },
  whyHeadline: { fontSize: 12, fontWeight: "700", color: "#7a4a3d", marginTop: 4, lineHeight: 17 },
  whyReason: { fontSize: 12, color: "#7a4a3d", marginTop: 4, lineHeight: 17 },
  modeTag: { fontSize: 10, fontWeight: "700", color: "#a3402f", marginTop: 6 },
  option: {
    borderWidth: 2,
    borderColor: "#eee5d8",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
    backgroundColor: "#fbf6ee",
  },
  optionLabel: { fontSize: 14, fontWeight: "600", color: "#2b2118" },
  voteBtn: {
    backgroundColor: CORAL,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  voteBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  voteError: { fontSize: 12, color: "#b91c1c", marginTop: 8 },
  answered: { fontSize: 12, color: "#0f766e", marginTop: 10, fontWeight: "600" },
  awardBox: {
    backgroundColor: "#e8f2ef",
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },
  awardText: { fontSize: 12, fontWeight: "700", color: "#0f766e", lineHeight: 17 },
  guestNotice: { fontSize: 12, color: "#7a4a3d", marginTop: 6, lineHeight: 17 },
  resultsHead: { fontSize: 12, fontWeight: "800", color: "#2b2118" },
  resultLabel: { fontSize: 13, fontWeight: "600", color: "#2b2118", flex: 1 },
  resultPct: { fontSize: 12, fontWeight: "700", color: "#0f766e" },
  barTrack: {
    height: 8,
    backgroundColor: "#f3ece1",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 4,
  },
  barFill: { height: 8, backgroundColor: CORAL, borderRadius: 999 },
  resultRaw: { fontSize: 11, color: "#a3968a", marginTop: 3 },
  methodNote: { fontSize: 11, color: "#8a7a6a", marginTop: 10, lineHeight: 16 },
});
