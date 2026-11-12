import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../../lib/api";

interface Wallet {
  points: number;
  sweepstakesEntries: number;
  revShareCents: number;
  tier: string;
}

export default function RewardsScreen() {
  const [wallet, setWallet] = useState<Wallet | null>(null);

  useEffect(() => {
    api
      .session()
      .then((s) => api.wallet(s.member.id))
      .then((w) => setWallet(w as unknown as Wallet))
      .catch(() => setWallet(null));
  }, []);

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={s.h1}>Your earnings</Text>
      <Text style={s.sub}>Thought patterns you express anyway — sponsored polls pay for them.</Text>
      {!wallet ? (
        <ActivityIndicator color="#d94f3d" style={{ marginTop: 48 }} />
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
          <View style={s.tierCard}>
            <Text style={{ fontSize: 28 }}>🦜</Text>
            <Text style={s.tier}>{wallet.tier.replace("_", " ").toLowerCase()} tier</Text>
            <Text style={s.tierSub}>
              Full tier ladder, activity history, and perks live in the web app.
            </Text>
          </View>
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
  tierSub: { fontSize: 12, color: "#8a7a6a", marginTop: 4, textAlign: "center", lineHeight: 17 },
});
