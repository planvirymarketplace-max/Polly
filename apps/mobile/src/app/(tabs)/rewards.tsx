import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { api, isAuthRequiredError, type WalletDTO } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { EmptyCard, ErrorCard, SignInPrompt } from "../../components/States";

const CORAL = "#d94f3d";

function progressPct(w: WalletDTO): number {
  const { current, next } = w.tierProgress;
  if (next === null || next <= current) return 100;
  return Math.min(100, Math.max(0, (current / next) * 100));
}

export default function RewardsScreen() {
  const { status, isLocalGuest } = useAuth();
  const authed = status === "signed-in" || (status === "guest" && !isLocalGuest);
  const [wallet, setWallet] = useState<WalletDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNeedsAuth(false);
    try {
      setWallet(await api.wallet());
    } catch (e) {
      if (isAuthRequiredError(e)) {
        setNeedsAuth(true);
        setWallet(null);
      } else {
        setError(e instanceof Error ? e.message : "Could not load your wallet.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) void load();
    else setLoading(false);
  }, [authed, load]);

  const claimHeld = async () => {
    setClaiming(true);
    setClaimMsg(null);
    try {
      const r = await api.claimGuest();
      setClaimMsg(`Claimed ${r.claimedPoints} held points. Your balance is now ${r.points}.`);
      await load();
    } catch (e) {
      setClaimMsg(
        e instanceof Error
          ? `Couldn't claim held points yet: ${e.message}`
          : "Couldn't claim held points yet.",
      );
    } finally {
      setClaiming(false);
    }
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={s.h1}>Your earnings</Text>
      <Text style={s.sub}>Thought patterns you express anyway — sponsored polls pay for them.</Text>
      {loading ? (
        <ActivityIndicator color={CORAL} style={{ marginTop: 48 }} />
      ) : !authed || needsAuth ? (
        <SignInPrompt body="Your wallet — points, sweepstakes entries, revenue share and tier — lives on your signed-in account." />
      ) : error ? (
        <ErrorCard message={error} onRetry={() => void load()} />
      ) : !wallet ? (
        <EmptyCard
          title="No wallet yet"
          body="We couldn't find a wallet for this account. Answer a sponsored poll and your earnings will show up here."
        />
      ) : (
        <>
          <View style={s.row}>
            <View style={[s.balance, { backgroundColor: "#fdf3dc" }]}>
              <Text style={s.balanceIcon}>🪙</Text>
              <Text style={s.balanceValue}>{wallet.points.toLocaleString()}</Text>
              <Text style={s.balanceLabel}>Points</Text>
            </View>
            <View style={[s.balance, { backgroundColor: "#e8f2ef" }]}>
              <Text style={s.balanceIcon}>🎟️</Text>
              <Text style={s.balanceValue}>{wallet.sweepstakesEntries}</Text>
              <Text style={s.balanceLabel}>Entries</Text>
            </View>
            <View style={[s.balance, { backgroundColor: "#e6f4ea" }]}>
              <Text style={s.balanceIcon}>📈</Text>
              <Text style={s.balanceValue}>${(wallet.revShareCents / 100).toFixed(2)}</Text>
              <Text style={s.balanceLabel}>Rev share</Text>
            </View>
          </View>

          {wallet.unclaimedPoints > 0 ? (
            <View style={s.heldCard}>
              <Text style={s.heldTitle}>
                ⏳ {wallet.unclaimedPoints.toLocaleString()} points held — create an account to
                claim
              </Text>
              <Text style={s.heldBody}>
                {wallet.accountType === "GUEST"
                  ? "These points were earned as a guest. Sign in or create an account and they move to your balance."
                  : "You have unclaimed points on this account."}
              </Text>
              {wallet.accountType === "GUEST" ? (
                <Link href="/auth" asChild>
                  <Pressable style={s.claimBtn}>
                    <Text style={s.claimBtnText}>Create an account to claim</Text>
                  </Pressable>
                </Link>
              ) : (
                <Pressable onPress={() => void claimHeld()} disabled={claiming} style={[s.claimBtn, claiming && { opacity: 0.5 }]}>
                  <Text style={s.claimBtnText}>{claiming ? "Claiming…" : "Claim held points"}</Text>
                </Pressable>
              )}
              {claimMsg ? <Text style={s.claimMsg}>{claimMsg}</Text> : null}
            </View>
          ) : null}

          <View style={s.tierCard}>
            <Text style={{ fontSize: 28 }}>🦜</Text>
            <Text style={s.tier}>{wallet.tier.replace("_", " ").toLowerCase()} tier</Text>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${progressPct(wallet)}%` }]} />
            </View>
            <Text style={s.tierSub}>
              {wallet.tierProgress.current.toLocaleString()} points · {wallet.tierProgress.label}
            </Text>
          </View>

          <Text style={s.section}>Recent activity</Text>
          {wallet.transactions.length === 0 ? (
            <EmptyCard
              title="No earnings yet"
              body="Answer a sponsored poll and the points, entries and revenue share will land here."
            />
          ) : (
            wallet.transactions.map((t) => (
              <View key={t.id} style={s.tx}>
                <View style={{ flex: 1 }}>
                  <Text style={s.txMemo}>{t.memo}</Text>
                  <Text style={s.txDate}>
                    {t.kind} · {new Date(t.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={s.txAmount}>
                  {t.kind === "REV_SHARE" ? `$${(t.amount / 100).toFixed(2)}` : `+${t.amount}`}
                </Text>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fbf6ee" },
  h1: { fontSize: 24, fontWeight: "800", color: "#2b2118" },
  sub: { fontSize: 13, color: "#8a7a6a", marginTop: 4, marginBottom: 16 },
  row: { flexDirection: "row", gap: 10 },
  balance: { flex: 1, borderRadius: 20, padding: 12 },
  balanceIcon: { fontSize: 16 },
  balanceValue: { fontSize: 18, fontWeight: "800", color: "#2b2118", marginTop: 6 },
  balanceLabel: { fontSize: 11, color: "#8a7a6a", marginTop: 2 },
  heldCard: {
    backgroundColor: "#fdf3dc",
    borderWidth: 1,
    borderColor: "#f0dfae",
    borderRadius: 20,
    padding: 16,
    marginTop: 12,
  },
  heldTitle: { fontSize: 14, fontWeight: "800", color: "#2b2118", lineHeight: 19 },
  heldBody: { fontSize: 12, color: "#6b5d4e", marginTop: 6, lineHeight: 17 },
  claimBtn: {
    backgroundColor: CORAL,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  claimBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  claimMsg: { fontSize: 12, color: "#6b5d4e", marginTop: 8, lineHeight: 17 },
  tierCard: {
    backgroundColor: "#fffdf9",
    borderWidth: 1,
    borderColor: "#eee5d8",
    borderRadius: 24,
    padding: 20,
    alignItems: "center",
    marginTop: 14,
  },
  tier: { fontSize: 16, fontWeight: "800", color: "#2b2118", marginTop: 8, textTransform: "capitalize" },
  progressTrack: {
    width: "100%",
    height: 8,
    backgroundColor: "#f3ece1",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 12,
  },
  progressFill: { height: 8, backgroundColor: CORAL, borderRadius: 999 },
  tierSub: { fontSize: 12, color: "#8a7a6a", marginTop: 8, textAlign: "center", lineHeight: 17 },
  section: { fontSize: 15, fontWeight: "800", color: "#2b2118", marginTop: 22, marginBottom: 8 },
  tx: {
    flexDirection: "row",
    backgroundColor: "#fffdf9",
    borderWidth: 1,
    borderColor: "#eee5d8",
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    alignItems: "center",
    gap: 10,
  },
  txMemo: { fontSize: 13, fontWeight: "600", color: "#2b2118", lineHeight: 18 },
  txDate: { fontSize: 11, color: "#a3968a", marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: "800", color: "#0f766e" },
});
