// Shared honest-state UI: error / empty / sign-in-required cards.
// Every screen renders from the API or one of these — never a spinner
// forever, never invented data.

import { Pressable, Text, View } from "react-native";
import { Link } from "expo-router";

export const CORAL = "#d94f3d";

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View
      style={{
        backgroundColor: "#fffdf9",
        borderWidth: 1,
        borderColor: "#eee5d8",
        borderRadius: 20,
        padding: 16,
        marginTop: 12,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: "700", color: "#2b2118" }}>
        Couldn't load this
      </Text>
      <Text style={{ fontSize: 13, color: "#6b5d4e", marginTop: 6, lineHeight: 19 }}>
        {message}
      </Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={{ backgroundColor: CORAL, borderRadius: 14, paddingVertical: 12, alignItems: "center", marginTop: 12 }}
        >
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <View
      style={{
        backgroundColor: "#fffdf9",
        borderWidth: 1,
        borderColor: "#eee5d8",
        borderRadius: 20,
        padding: 20,
        marginTop: 12,
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: "800", color: "#2b2118", textAlign: "center" }}>
        {title}
      </Text>
      <Text style={{ fontSize: 13, color: "#8a7a6a", marginTop: 6, textAlign: "center", lineHeight: 19 }}>
        {body}
      </Text>
    </View>
  );
}

export function SignInPrompt({ body }: { body: string }) {
  return (
    <View
      style={{
        backgroundColor: "#fffdf9",
        borderWidth: 1,
        borderColor: "#eee5d8",
        borderRadius: 20,
        padding: 20,
        marginTop: 12,
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: "800", color: "#2b2118", textAlign: "center" }}>
        Sign in to continue
      </Text>
      <Text style={{ fontSize: 13, color: "#8a7a6a", marginTop: 6, textAlign: "center", lineHeight: 19 }}>
        {body}
      </Text>
      <Link href="/auth" asChild>
        <Pressable
          style={{ backgroundColor: CORAL, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24, marginTop: 14 }}
        >
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>Sign in</Text>
        </Pressable>
      </Link>
    </View>
  );
}
