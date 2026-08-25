import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "../theme";
import { api, parseDate } from "../api";
import { WorkoutSession } from "../types";
import { kg } from "./WorkoutHomeScreen";

export default function WorkoutSessionsScreen({ navigation }: any) {
  const t = useTheme();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string) => {
    try {
      setSessions(await api.workouts.sessions(q.trim() ? { q: q.trim() } : {}));
      setError(null);
    } catch (err: any) {
      setError(err.message || "Couldn't load sessions.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(query);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load])
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Starting a workout drops you straight into logging sets.
  async function startSession() {
    setStarting(true);
    try {
      const created = await api.workouts.createSession({ name: "" });
      navigation.navigate("WorkoutSession", { sessionId: created.id });
    } catch (err: any) {
      Alert.alert("Couldn't start a session", err.message);
    } finally {
      setStarting(false);
    }
  }

  function remove(s: WorkoutSession) {
    Alert.alert(`Delete "${s.name || "Workout"}"?`, "Every set logged in it goes too.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.workouts.removeSession(s.id);
            await load(query);
          } catch (err: any) {
            Alert.alert("Couldn't delete", err.message);
          }
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <View style={styles.header}>
        <View style={[styles.searchRow, { borderColor: t.rule, backgroundColor: t.page }]}>
          <Ionicons name="search" size={15} color={t.inkMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search sessions"
            placeholderTextColor={t.inkMuted}
            style={[styles.searchInput, { color: t.ink }]}
          />
        </View>
        <Pressable
          onPress={startSession}
          disabled={starting}
          style={[styles.addBtn, { backgroundColor: t.accent, opacity: starting ? 0.6 : 1 }]}
        >
          <Ionicons name="add" size={20} color={t.accentInk} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load(query);
              setRefreshing(false);
            }}
            tintColor={t.accent}
          />
        }
      >
        {error && <Text style={{ color: t.inkMuted, fontSize: 13 }}>{error}</Text>}

        {!error && sessions.length === 0 && (
          <Text style={{ color: t.inkMuted, fontSize: 13 }}>
            {query ? "Nothing matches your search." : "No sessions yet — tap + to start one."}
          </Text>
        )}

        {sessions.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => navigation.navigate("WorkoutSession", { sessionId: s.id })}
            onLongPress={() => remove(s)}
            style={[styles.card, { backgroundColor: t.page2 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.ink, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
                {s.name || "Workout"}
              </Text>
              <Text style={{ color: t.inkMuted, fontSize: 11.5, marginTop: 2 }}>
                {parseDate(s.occurred_on).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                {" · "}
                {s.set_count} set{s.set_count === 1 ? "" : "s"} · {s.total_reps} reps
              </Text>
            </View>
            <Text style={{ color: t.ink, fontFamily: fonts.mono, fontSize: 13, marginRight: 6 }}>{kg(s.volume)}</Text>
            <Ionicons name="chevron-forward" size={15} color={t.inkMuted} />
          </Pressable>
        ))}

        {sessions.length > 0 && (
          <Text style={{ color: t.inkMuted, fontSize: 11, textAlign: "center", marginTop: 8 }}>
            Tap to open · long-press to delete
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", gap: 8, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6 },
  searchRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 13, padding: 0 },
  addBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  list: { padding: 18, paddingTop: 8, gap: 10 },
  card: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 14 },
});
