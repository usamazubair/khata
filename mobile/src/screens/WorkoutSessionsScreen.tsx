import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "../theme";
import { api, parseDate } from "../api";
import { WorkoutSession } from "../types";

export default function WorkoutSessionsScreen({ navigation }: any) {
  const t = useTheme();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
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
            {query ? "Nothing matches your search." : "No sessions yet — plans and generating a week happen on the web dashboard."}
          </Text>
        )}

        {sessions.map((s) => {
          const done = s.total_exercises > 0 && s.completed_exercises === s.total_exercises;
          const tone = done ? t.status.good : s.completed_exercises > 0 ? t.status.warning : t.inkMuted;
          return (
            <Pressable
              key={s.id}
              onPress={() => navigation.navigate("WorkoutSession", { sessionId: s.id })}
              style={[styles.card, { backgroundColor: t.page2 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.ink, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
                  {s.name || "Workout"}
                </Text>
                <Text style={{ color: t.inkMuted, fontSize: 11.5, marginTop: 2 }}>
                  {parseDate(s.occurred_on).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                </Text>
              </View>
              <Text style={{ color: tone, fontFamily: fonts.mono, fontSize: 13, fontWeight: "600", marginRight: 6 }}>
                {s.total_exercises === 0 ? "—" : `${s.completed_exercises}/${s.total_exercises}`}
              </Text>
              <Ionicons name="chevron-forward" size={15} color={t.inkMuted} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 13, padding: 0 },
  list: { padding: 18, paddingTop: 8, gap: 10 },
  card: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 14 },
});
