import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme, fonts } from "../theme";
import { api, parseDate } from "../api";
import { WorkoutSession, WorkoutSummary } from "../types";

// Weights are kg, not currency — money() would print "Rs". Kept exported
// since other workout screens still import it for this reason.
export function kg(n: number | string) {
  const num = Number(n) || 0;
  return num.toLocaleString(undefined, { maximumFractionDigits: num % 1 ? 1 : 0 }) + " kg";
}

function SessionRow({ s, onPress, t }: { s: WorkoutSession; onPress: () => void; t: ReturnType<typeof useTheme> }) {
  const done = s.total_exercises > 0 && s.completed_exercises === s.total_exercises;
  const tone = done ? t.status.good : s.completed_exercises > 0 ? t.status.warning : t.inkMuted;
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.ink, fontSize: 13.5 }} numberOfLines={1}>
          {s.name || "Workout"}
        </Text>
        <Text style={{ color: t.inkMuted, fontSize: 11, marginTop: 2 }}>
          {parseDate(s.occurred_on).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
        </Text>
      </View>
      <Text style={{ color: tone, fontFamily: fonts.mono, fontSize: 12.5, fontWeight: "600" }}>
        {s.total_exercises === 0 ? "—" : `${s.completed_exercises}/${s.total_exercises}`}
      </Text>
    </Pressable>
  );
}

export default function WorkoutHomeScreen({ navigation }: any) {
  const t = useTheme();
  const [data, setData] = useState<WorkoutSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.workouts.summary());
      setError(null);
    } catch (err: any) {
      setError(err.message || "Couldn't load your workouts.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const weekTotal = data?.this_week.reduce((n, s) => n + s.total_exercises, 0) ?? 0;
  const weekDone = data?.this_week.reduce((n, s) => n + s.completed_exercises, 0) ?? 0;
  const fullyDone = data?.this_week.filter((s) => s.total_exercises > 0 && s.completed_exercises === s.total_exercises).length ?? 0;

  return (
    <ScrollView
      style={{ backgroundColor: t.paper }}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor={t.accent}
        />
      }
    >
      <Text style={[styles.wordmark, { color: t.ink, fontFamily: fonts.display }]}>This week</Text>

      {error && (
        <View style={[styles.card, { backgroundColor: t.page2 }]}>
          <Text style={{ color: t.inkMuted, fontSize: 13 }}>{error}</Text>
        </View>
      )}

      {data && (
        <>
          <View style={[styles.card, { backgroundColor: t.page2 }]}>
            <Text style={[styles.label, { color: t.inkMuted }]}>Exercises done this week</Text>
            <Text style={[styles.hero, { color: t.ink, fontFamily: fonts.mono }]}>
              {weekDone} <Text style={{ fontSize: 18, color: t.inkMuted }}>/ {weekTotal}</Text>
            </Text>
            <Text style={{ color: t.inkMuted, fontSize: 12, marginTop: 6 }}>
              {fullyDone} of {data.this_week.length} session{data.this_week.length === 1 ? "" : "s"} fully done
            </Text>
          </View>

          <View style={styles.statRow}>
            <View style={[styles.statTile, { backgroundColor: t.page2 }]}>
              <Text style={[styles.label, { color: t.inkMuted }]}>Sessions</Text>
              <Text style={[styles.statValue, { color: t.ink, fontFamily: fonts.mono }]}>{data.this_week.length}</Text>
            </View>
            <View style={[styles.statTile, { backgroundColor: t.page2 }]}>
              <Text style={[styles.label, { color: t.inkMuted }]}>Plans</Text>
              <Text style={[styles.statValue, { color: t.ink, fontFamily: fonts.mono }]}>{data.totals.active_plans}</Text>
            </View>
            <View style={[styles.statTile, { backgroundColor: t.page2 }]}>
              <Text style={[styles.label, { color: t.inkMuted }]}>All time</Text>
              <Text style={[styles.statValue, { color: t.ink, fontFamily: fonts.mono }]}>{data.totals.total_sessions}</Text>
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: t.inkMuted }]}>This week's sessions</Text>
          <View style={[styles.card, { backgroundColor: t.page2 }]}>
            {data.this_week.length === 0 && (
              <Text style={{ color: t.inkMuted, fontSize: 13 }}>
                Nothing scheduled — plans and generating a week happen on the web dashboard.
              </Text>
            )}
            {data.this_week.map((s, i) => (
              <View key={s.id} style={{ borderBottomWidth: i === data.this_week.length - 1 ? 0 : 1, borderColor: t.rule }}>
                <SessionRow s={s} t={t} onPress={() => navigation.navigate("WorkoutSession", { sessionId: s.id })} />
              </View>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { color: t.inkMuted }]}>Recent sessions</Text>
          <View style={[styles.card, { backgroundColor: t.page2 }]}>
            {data.recent.length === 0 && <Text style={{ color: t.inkMuted, fontSize: 13 }}>No sessions yet.</Text>}
            {data.recent.map((s, i) => (
              <View key={s.id} style={{ borderBottomWidth: i === data.recent.length - 1 ? 0 : 1, borderColor: t.rule }}>
                <SessionRow s={s} t={t} onPress={() => navigation.navigate("WorkoutSession", { sessionId: s.id })} />
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 40 },
  wordmark: { fontSize: 28, marginBottom: 16 },
  card: { borderRadius: 14, padding: 15 },
  label: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6 },
  hero: { fontSize: 32, fontWeight: "600", marginTop: 4 },
  statRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  statTile: { flex: 1, borderRadius: 12, padding: 12 },
  statValue: { fontSize: 17, fontWeight: "600", marginTop: 4 },
  sectionLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 22, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
});
