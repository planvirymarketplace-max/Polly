// Sign-in screen. Presents every auth method honestly:
// a method whose configuration is missing shows "coming soon — needs
// configuration" and is disabled; a method whose provider isn't enabled
// in Supabase shows Supabase's own error. Nothing here fakes a sign-in.

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useAuth, type AuthResult } from "../lib/auth";

const CORAL = "#d94f3d";

export default function AuthScreen() {
  const auth = useAuth();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [email, setEmail] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Leave as soon as a session (or guest) exists.
  useEffect(() => {
    if (auth.status === "signed-in" || auth.status === "guest") router.replace("/(tabs)");
  }, [auth.status]);

  const run = async (label: string, fn: () => Promise<AuthResult>) => {
    setBusy(label);
    setError(null);
    setInfo(null);
    try {
      const r = await fn();
      if (!r.ok) {
        setError(
          r.needsConfig
            ? `${r.error} This method will work once Sunny adds the Supabase configuration.`
            : (r.error ?? "Sign-in failed."),
        );
      } else if (r.message) {
        setInfo(r.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(null);
    }
  };

  const configured = auth.isSupabaseConfigured;

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      <Text style={s.h1}>Join Polly</Text>
      <Text style={s.sub}>
        Sign in to vote in sponsored polls, earn points, and claim guest rewards. Your takes
        shape what sponsors ask — and why they ask you.
      </Text>

      {!configured ? (
        <View style={s.configBanner}>
          <Text style={s.configTitle}>Sign-in isn't configured yet</Text>
          <Text style={s.configBody}>
            Missing: {auth.missingConfig.join(", ")}. Until Sunny adds the Supabase project
            credentials, Google, Apple, phone and magic-link sign-in are coming soon — you can
            still browse the Commons as a guest below.
          </Text>
        </View>
      ) : null}

      {error ? <Text style={s.error}>{error}</Text> : null}
      {info ? <Text style={s.info}>{info}</Text> : null}
      {auth.lastError && !error ? <Text style={s.error}>{auth.lastError}</Text> : null}

      <Text style={s.section}>Continue with</Text>
      <AuthButton
        label="Continue with Google"
        busy={busy === "google"}
        disabled={!configured}
        needsConfig={!configured}
        onPress={() => void run("google", auth.signInWithGoogle)}
      />
      <AuthButton
        label="Continue with Apple"
        busy={busy === "apple"}
        disabled={!configured}
        needsConfig={!configured}
        onPress={() => void run("apple", auth.signInWithApple)}
      />

      <Text style={s.section}>Phone</Text>
      <TextInput
        style={s.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="+1 555 010 1234"
        placeholderTextColor="#a3968a"
        keyboardType="phone-pad"
        autoComplete="tel"
        editable={configured}
      />
      {codeSent ? (
        <TextInput
          style={[s.input, { marginTop: 8 }]}
          value={code}
          onChangeText={setCode}
          placeholder="6-digit code"
          placeholderTextColor="#a3968a"
          keyboardType="number-pad"
          editable={configured}
        />
      ) : null}
      {!codeSent ? (
        <AuthButton
          label="Text me a code"
          busy={busy === "phone-send"}
          disabled={!configured || !phone.trim()}
          needsConfig={!configured}
          onPress={() =>
            run("phone-send", async () => {
              const r = await auth.sendPhoneOtp(phone);
              if (r.ok) setCodeSent(true);
              return r;
            })
          }
        />
      ) : (
        <AuthButton
          label="Verify code"
          busy={busy === "phone-verify"}
          disabled={!configured || !code.trim()}
          needsConfig={!configured}
          onPress={() => void run("phone-verify", () => auth.verifyPhoneOtp(phone, code))}
        />
      )}
      <Text style={s.hint}>
        Phone sign-in needs Twilio configured in the Supabase project; otherwise Supabase
        returns its own error here.
      </Text>

      <Text style={s.section}>Email</Text>
      <TextInput
        style={s.input}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor="#a3968a"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        editable={configured}
      />
      <AuthButton
        label="Email me a sign-in link"
        busy={busy === "magic"}
        disabled={!configured || !email.trim()}
        needsConfig={!configured}
        onPress={() => void run("magic", () => auth.sendMagicLink(email))}
      />

      <Text style={s.section}>Or just look around</Text>
      <Pressable
        onPress={() => void run("guest", auth.continueAsGuest)}
        disabled={busy === "guest"}
        style={[s.guestBtn, busy === "guest" && { opacity: 0.5 }]}
      >
        {busy === "guest" ? (
          <ActivityIndicator color="#2b2118" />
        ) : (
          <Text style={s.guestBtnText}>Continue as guest</Text>
        )}
      </Pressable>
      <Text style={s.hint}>
        Guests can read the Commons. Voting and earning need an account — guest points are
        held and claimable the moment you create one.
      </Text>
    </ScrollView>
  );
}

function AuthButton({
  label,
  onPress,
  disabled,
  busy,
  needsConfig,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  busy: boolean;
  needsConfig: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={[s.btn, (disabled || busy) && { opacity: 0.55 }]}
    >
      {busy ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={s.btnText}>
          {label}
          {needsConfig ? " — coming soon, needs configuration" : ""}
        </Text>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fbf6ee" },
  h1: { fontSize: 26, fontWeight: "800", color: "#2b2118", marginTop: 24 },
  sub: { fontSize: 13, color: "#8a7a6a", marginTop: 6, lineHeight: 19 },
  section: { fontSize: 15, fontWeight: "800", color: "#2b2118", marginTop: 22, marginBottom: 8 },
  configBanner: {
    backgroundColor: "#fdf3dc",
    borderWidth: 1,
    borderColor: "#f0dfae",
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
  },
  configTitle: { fontSize: 14, fontWeight: "800", color: "#2b2118" },
  configBody: { fontSize: 12, color: "#6b5d4e", marginTop: 4, lineHeight: 17 },
  error: { fontSize: 13, color: "#b91c1c", marginTop: 12, lineHeight: 18 },
  info: { fontSize: 13, color: "#0f766e", marginTop: 12, lineHeight: 18 },
  btn: {
    backgroundColor: CORAL,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 14, textAlign: "center", paddingHorizontal: 12 },
  guestBtn: {
    borderWidth: 1,
    borderColor: "#eee5d8",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
    backgroundColor: "#fffdf9",
  },
  guestBtnText: { fontSize: 14, fontWeight: "700", color: "#2b2118" },
  input: {
    borderWidth: 1,
    borderColor: "#eee5d8",
    borderRadius: 14,
    padding: 12,
    fontSize: 15,
    color: "#2b2118",
    backgroundColor: "#fff",
  },
  hint: { fontSize: 11, color: "#a3968a", marginTop: 8, lineHeight: 16 },
});
