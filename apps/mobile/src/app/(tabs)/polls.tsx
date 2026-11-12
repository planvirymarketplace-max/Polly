import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../../lib/api";

interface Poll {
  id: string;
  question: string;
  context: string | null;
  samplingMode: string;
  rewardPoints: number;
  sponsor: { name: string; kind: string };
  options: { id: string; label: string }[];
  alreadyResponded: boolean;
  explanation: { headline: string; reasons: string[] } | null;
}

export default function PollsScreen() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const session = await api.session();
        const d = await api.polls(session.member.id);
        setPolls(d.live as unknown as Poll[]);
      } catch {
        setPolls([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const vote = async (pollId: string) => {
    const optionId = selected[pollId];
    if (!optionId) return;
    try {
      const session = await api.session();
      await api.vote(pollId, optionId, session.member.id);
      const d = await api.polls(session.member.id);
      setPolls(d.live as unknown as Poll[]);
    } catch (e) {
      console.warn("vote failed", e);
    }
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={s.h1}>Selected for you</Text>
      <Text style={s.sub}>
        Sponsors pay to hear from people who engage. You always see why you were picked.
      </Text>
      {loading ? (
        <ActivityIndicator color={CORAL} style={{ marginTop: 48 }} />
      ) : (
        polls.map((p) => (
          <View key={p.id} style={s.card}>
            <View style={s.sponsorRow}>
              <View style={s.sponsorIcon}>
                <Text style={{ fontSize: 14 }}>{SPONSOR_EMOJI[p.sponsor.kind] ?? "🏛️"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.sponsorName}>{p.sponsor.name}</Text>
                <Text style={s.sponsorSub}>Sponsored poll</Text>
              </View>
              <Text style={s.reward}>+{p.rewardPoints}</Text>
            </View>

            <Text style={s.question}>{p.question}</Text>
            {p.context ? <Text style={s.context}>{p.context}</Text> : null}

            {p.explanation && (
              <View style={s.why}>
                <Text style={s.whyHead}>👁 Why you were selected</Text>
                {p.explanation.reasons.map((r, i) => (
                  <Text key={i} style={s.whyReason}>
                    › {r}
                  </Text>
                ))}
                <Text style={s.modeTag}>{MODE_LABEL[p.samplingMode] ?? p.samplingMode}</Text>
              </View>
            )}

            {p.options.map((o) => (
              <Pressable
                key={o.id}
                onPress={() => setSelected((prev) => ({ ...prev, [p.id]: o.id }))}
                style={[
                  s.option,
                  selected[p.id] === o.id && { borderColor: CORAL, backgroundColor: "#fdeae5" },
                ]}
              >
                <Text style={s.optionLabel}>{o.label}</Text>
              </Pressable>
            ))}

            {!p.alreadyResponded && (
              <Pressable
                onPress={() => vote(p.id)}
                disabled={!selected[p.id]}
                style={[s.voteBtn, !selected[p.id] && { opacity: 0.4 }]}
              >
                <Text style={s.voteBtnText}>Weigh in</Text>
              </Pressable>
            )}
            {p.alreadyResponded && <Text style={s.answered}>✓ You responded — see web app for full weighted results</Text>}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const CORAL = "#d94f3d";
const SPONSOR_EMOJI: Record<string, string> = {
  STATION: "📺",
  NONPROFIT: "🤝",
  RESEARCH: "🔬",
  BRAND: "🛒",
  ADVOCACY: "🏛️",
};
const MODE_LABEL: Record<string, string> = {
  QUOTA_UGC: "Quota + UGC",
  UGC_MATCH: "UGC Match",
  RANDOM: "Random Draw",
  SPONSOR_SEGMENT: "Sponsor Segment",
};

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fbf6ee" },
  h1: { fontSize: 24, fontWeight: "800", color: "#2b2118" },
  sub: { fontSize: 13, color: "#8a7a6a", marginTop: 4, marginBottom: 16 },
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
  why: {
    backgroundColor: "#fbe9e2",
    borderRadius: 16,
    padding: 12,
    marginTop: 10,
  },
  whyHead: { fontSize: 12, fontWeight: "800", color: "#a3402f" },
  whyReason: { fontSize: 12, color: "#7a4a3d", marginTop: 4, lineHeight: 17 },
  modeTag: {
    fontSize: 10,
    fontWeight: "700",
    color: "#a3402f",
    marginTop: 6,
  },
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
  answered: { fontSize: 12, color: "#0f766e", marginTop: 10, fontWeight: "600" },
});
