import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, isAuthRequiredError, type ProfileDTO } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { EmptyCard, ErrorCard, SignInPrompt } from "../../components/States";

const CORAL = "#d94f3d";

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <View style={{ height: 8, backgroundColor: "#f3ece1", borderRadius: 999, overflow: "hidden", marginTop: 6 }}>
      <View style={{ height: 8, width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color, borderRadius: 999 }} />
    </View>
  );
}

export default function ProfileScreen() {
  const { status, isLocalGuest, user, signOut } = useAuth();
  const authed = status === "signed-in" || (status === "guest" && !isLocalGuest);
  const [profile, setProfile] = useState<ProfileDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNeedsAuth(false);
    try {
      setProfile(await api.profile());
    } catch (e) {
      if (isAuthRequiredError(e)) {
        setNeedsAuth(true);
        setProfile(null);
      } else {
        setError(e instanceof Error ? e.message : "Could not load your profile.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) void load();
    else setLoading(false);
  }, [authed, load]);

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {loading ? (
        <ActivityIndicator color={CORAL} style={{ marginTop: 48 }} />
      ) : !authed || needsAuth ? (
        <>
          <SignInPrompt body="Your profile — handle, tier, stats and what Polly knows about you — lives on your signed-in account." />
          {isLocalGuest ? (
            <Text style={s.guestNote}>
              You're browsing as a guest. Guest points are held — create an account to claim them.
            </Text>
          ) : null}
        </>
      ) : error ? (
        <ErrorCard message={error} onRetry={() => void load()} />
      ) : !profile ? (
        <EmptyCard
          title="No profile yet"
          body="We couldn't find a profile for this account."
        />
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
                {profile.accountType === "GUEST" ? " · guest" : ""}
              </Text>
              {user?.email ? <Text style={s.meta}>{user.email}</Text> : null}
            </View>
          </View>

          {profile.accountType === "GUEST" ? (
            <View style={s.guestBanner}>
              <Text style={s.guestBannerText}>
                Guest account — points you earn are held. Create an account to claim them.
              </Text>
            </View>
          ) : null}

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
          {profile.interests.length === 0 ? (
            <EmptyCard
              title="No interests inferred yet"
              body="Comment on happenings in the Commons and Polly will learn what you care about — and show you exactly what it learned, here."
            />
          ) : (
            <View style={s.card}>
              {profile.interests.map((i) => (
                <View key={i.topic.slug} style={{ marginBottom: 12 }}>
                  <Text style={s.interestLabel}>
                    {i.topic.emoji} {i.topic.label} · {Math.round(i.affinity * 100)}%
                  </Text>
                  <Bar pct={i.affinity * 100} color={CORAL} />
                </View>
              ))}
            </View>
          )}

          <Pressable
            onPress={() => {
              setSigningOut(true);
              void signOut().finally(() => setSigningOut(false));
            }}
            disabled={signingOut}
            style={[s.signOutBtn, signingOut && { opacity: 0.5 }]}
          >
            <Text style={s.signOutText}>{signingOut ? "Signing out…" : "Sign out"}</Text>
          </Pressable>
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
    backgroundColor: CORAL,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 20, fontWeight: "800", color: "#2b2118" },
  handle: { fontSize: 13, color: "#8a7a6a" },
  meta: { fontSize: 12, color: "#a3968a", marginTop: 2 },
  guestNote: { fontSize: 13, color: "#6b5d4e", marginTop: 14, textAlign: "center", lineHeight: 19 },
  guestBanner: {
    backgroundColor: "#fdf3dc",
    borderWidth: 1,
    borderColor: "#f0dfae",
    borderRadius: 16,
    padding: 12,
    marginTop: 14,
  },
  guestBannerText: { fontSize: 13, color: "#6b5d4e", lineHeight: 18 },
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
  signOutBtn: {
    marginTop: 22,
    borderWidth: 1,
    borderColor: "#eee5d8",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#fffdf9",
  },
  signOutText: { fontSize: 14, fontWeight: "700", color: "#b91c1c" },
});
