import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../../lib/api";

interface Happening {
  id: string;
  title: string;
  summary: string;
  sourceName: string;
  metro: string | null;
  stateCode: string | null;
  hotness: number;
  commentCount: number;
  createdAt: string;
  topic: { label: string; emoji: string | null } | null;
}

export default function FeedScreen() {
  const [items, setItems] = useState<Happening[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .happenings()
      .then((d) => setItems(d.happenings as unknown as Happening[]))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeScroll>
      <Text style={s.h1}>The Commons</Text>
      <Text style={s.sub}>
        What's happening where it matters — comment, and the system learns what you care about.
      </Text>
      {loading ? (
        <ActivityIndicator color={CORAL} style={{ marginTop: 48 }} />
      ) : (
        items.map((h) => (
          <View key={h.id} style={s.card}>
            <View style={s.chipRow}>
              {h.topic && (
                <Text style={s.chip}>
                  {h.topic.emoji} {h.topic.label}
                </Text>
              )}
              <Text style={[s.chip, s.chipOutline]}>
                {h.metro ? `${h.metro}, ${h.stateCode}` : "National"}
              </Text>
              <Text style={s.heat}>🔥 {h.hotness.toLocaleString()}</Text>
            </View>
            <Text style={s.title}>{h.title}</Text>
            <Text style={s.summary}>{h.summary}</Text>
            <Text style={s.meta}>
              {h.sourceName} · {h.commentCount} {h.commentCount === 1 ? "take" : "takes"}
            </Text>
          </View>
        ))
      )}
    </SafeScroll>
  );
}

function SafeScroll({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

const CORAL = "#d94f3d";

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
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  chip: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0f766e",
    backgroundColor: "#e8f2ef",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  chipOutline: {
    color: "#8a7a6a",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#e5d9c8",
  },
  heat: { marginLeft: "auto", fontSize: 11, color: "#b45309" },
  title: { fontSize: 16, fontWeight: "700", color: "#2b2118", marginTop: 8, lineHeight: 22 },
  summary: { fontSize: 13, color: "#6b5d4e", marginTop: 6, lineHeight: 19 },
  meta: { fontSize: 11, color: "#a3968a", marginTop: 8 },
});
