import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../../lib/api";

interface Profile {
  handle: string;
  displayName: string;
  metro: string | null;
  tier: string;
  followerCount: number;
  pollsAnswered: number;
  commentsPosted: number;
  interests: { topic: { label: string; emoji: string | null }; affinity: number }[];
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <View style={{ height: 8, backgroundColor: "#f3ece1", borderRadius: 999, overflow: "hidden", marginTop: 6 }}>
      <View style={{ height: 8, width: `${pct}%`, backgroundColor: color, borderRadius: 999 }} />
    </View>
  );
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    api
      .session()
      .then((s) => api.profile(s.member.id))
      .then((p) => setProfile(p as unknown as Profile))
      .catch(() => setProfile(null));
  }, []);

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {!profile ? (
        <ActivityIndicator color="#d94f3d" style={{ marginTop: 48 }} />
      ) : (
        <>
          <View style={s.header}>
            <View style={s.avatar}>
              <Text style={{ fontSize: 26, fontWeight: "800", color: "#fff" }}>
                {profile.displayName.slice(0, 1)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{profile.displayName}</Text>
              <Text style={s.handle}>@{profile.handle}</Text>
              <Text style={s.meta}>
                {profile.metro ?? "national"} · {profile.tier.replace("_", " ").toLowerCase()} tier
              </Text>
            </View>
          </View>

          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={s.statValue}>{profile.followerCount}</Text>
              <Text style={s.statLabel}>followers</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statValue}>{profile.pollsAnswered}</Text>
              <Text style={s.statLabel}>polls</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statValue}>{profile.commentsPosted}</Text>
              <Text style={s.statLabel}>takes</Text>
            </View>
          </View>

          <Text style={s.section}>👁 What Polly knows about you</Text>
          <View style={s.card}>
            {profile.interests.map((i) => (
              <View key={i.topic.slug ?? i.topic.label} style={{ marginBottom: 12 }}>
                <Text style={s.interestLabel}>
                  {i.topic.emoji} {i.topic.label} · {Math.round(i.affinity * 100)}%
                </Text>
                <Bar pct={i.affinity * 100} color="#d94f3d" />
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fbf6ee" },
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: "#d94f3d",
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 20, fontWeight: "800", color: "#2b2118" },
  handle: { fontSize: 13, color: "#8a7a6a" },
  meta: { fontSize: 12, color: "#a3968a", marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  stat: {
    flex: 1,
    backgroundColor: "#fffdf9",
    borderWidth: 1,
    borderColor: "#eee5d8",
    borderRadius: 20,
    padding: 12,
    alignItems: "center",
  },
  statValue: { fontSize: 18, fontWeight: "800", color: "#2b2118" },
  statLabel: { fontSize: 11, color: "#8a7a6a", marginTop: 2 },
  section: { fontSize: 15, fontWeight: "800", color: "#2b2118", marginTop: 22, marginBottom: 8 },
  card: {
    backgroundColor: "#fffdf9",
    borderWidth: 1,
    borderColor: "#eee5d8",
    borderRadius: 24,
    padding: 16,
  },
  interestLabel: { fontSize: 13, fontWeight: "600", color: "#2b2118" },
});
