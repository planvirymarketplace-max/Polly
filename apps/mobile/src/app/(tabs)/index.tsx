import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, getApiBaseUrl, type HappeningDTO } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { EmptyCard, ErrorCard, SignInPrompt } from "../../components/States";

const CORAL = "#d94f3d";

export default function FeedScreen() {
  const { status, isLocalGuest } = useAuth();
  const canComment = status === "signed-in" || (status === "guest" && !isLocalGuest);
  const [items, setItems] = useState<HappeningDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentingOn, setCommentingOn] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await api.happenings();
      setItems(d.happenings ?? []);
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : "Could not load the feed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const postComment = async (happeningId: string) => {
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    setPostError(null);
    try {
      await api.postComment(happeningId, body);
      setDraft("");
      setCommentingOn(null);
      await load();
    } catch (e) {
      setPostError(e instanceof Error ? e.message : "Could not post your take.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={s.h1}>The Commons</Text>
      <Text style={s.sub}>
        What's happening where it matters — comment, and the system learns what you care about.
      </Text>
      {loading ? (
        <ActivityIndicator color={CORAL} style={{ marginTop: 48 }} />
      ) : error ? (
        <ErrorCard message={error} onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <EmptyCard
          title="Nothing happening yet"
          body={`No happenings have been published. The feed is live data from ${getApiBaseUrl()} — check back soon.`}
        />
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

            {(h.comments ?? []).map((c) => (
              <View key={c.id} style={s.comment}>
                <Text style={s.commentAuthor}>
                  {c.author.displayName} @{c.author.handle}
                </Text>
                <Text style={s.commentBody}>{c.body}</Text>
              </View>
            ))}

            {commentingOn === h.id ? (
              canComment ? (
                <View style={{ marginTop: 10 }}>
                  <TextInput
                    style={s.input}
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Add your take… (max 500 characters)"
                    placeholderTextColor="#a3968a"
                    multiline
                    maxLength={500}
                  />
                  {postError ? <Text style={s.inlineError}>{postError}</Text> : null}
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <Pressable
                      onPress={() => void postComment(h.id)}
                      disabled={posting || !draft.trim()}
                      style={[s.postBtn, (!draft.trim() || posting) && { opacity: 0.4 }]}
                    >
                      <Text style={s.postBtnText}>{posting ? "Posting…" : "Post take"}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setCommentingOn(null);
                        setDraft("");
                        setPostError(null);
                      }}
                      style={s.cancelBtn}
                    >
                      <Text style={s.cancelBtnText}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <SignInPrompt body="Sign in to add your take. Commenting is what teaches Polly what you care about." />
              )
            ) : (
              <Pressable onPress={() => setCommentingOn(h.id)} style={s.takeBtn}>
                <Text style={s.takeBtnText}>💬 Add your take</Text>
              </Pressable>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

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
  comment: {
    marginTop: 10,
    backgroundColor: "#fbf6ee",
    borderRadius: 14,
    padding: 10,
  },
  commentAuthor: { fontSize: 11, fontWeight: "700", color: "#0f766e" },
  commentBody: { fontSize: 13, color: "#2b2118", marginTop: 2, lineHeight: 18 },
  takeBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#eee5d8",
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  takeBtnText: { fontSize: 13, fontWeight: "700", color: "#2b2118" },
  input: {
    borderWidth: 1,
    borderColor: "#eee5d8",
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    color: "#2b2118",
    backgroundColor: "#fff",
    minHeight: 64,
    textAlignVertical: "top",
  },
  postBtn: {
    flex: 1,
    backgroundColor: CORAL,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  postBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  cancelBtn: {
    borderWidth: 1,
    borderColor: "#eee5d8",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 14, fontWeight: "700", color: "#6b5d4e" },
  inlineError: { fontSize: 12, color: "#b91c1c", marginTop: 6 },
});
