import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme, fonts } from "../theme";
import { api } from "../api";
import { WorkoutSummary } from "../types";
import ProgressBar from "../components/ProgressBar";

// Weights are kg, not currency — money() would print "Rs".
export function kg(n: number | string) {
  const num = Number(n) || 0;
  return num.toLocaleString(undefined, { maximumFractionDigits: num % 1 ? 1 : 0 }) + " kg";
}

export default function WorkoutHomeScreen() {
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

  const maxVolume = data?.top_exercises.length ? Math.max(...data.top_exercises.map((e) => e.volume)) : 1;
  const delta = data ? data.this_week.volume - data.last_week.volume : 0;

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
            <Text style={[styles.label, { color: t.inkMuted }]}>Volume this week</Text>
            <Text style={[styles.hero, { color: t.ink, fontFamily: fonts.mono }]}>{kg(data.this_week.volume)}</Text>
            <Text style={{ color: t.inkMuted, fontSize: 12, marginTop: 6 }}>
              {data.last_week.volume > 0
                ? `${delta >= 0 ? "▲" : "▼"} ${kg(Math.abs(delta))} vs last week`
                : "No sessions last week"}
            </Text>
          </View>

          <View style={styles.statRow}>
            <View style={[styles.statTile, { backgroundColor: t.page2 }]}>
              <Text style={[styles.label, { color: t.inkMuted }]}>Sessions</Text>
              <Text style={[styles.statValue, { color: t.ink, fontFamily: fonts.mono }]}>{data.this_week.sessions}</Text>
            </View>
            <View style={[styles.statTile, { backgroundColor: t.page2 }]}>
              <Text style={[styles.label, { color: t.inkMuted }]}>Reps</Text>
              <Text style={[styles.statValue, { color: t.ink, fontFamily: fonts.mono }]}>{data.this_week.reps}</Text>
            </View>
            <View style={[styles.statTile, { backgroundColor: t.page2 }]}>
              <Text style={[styles.label, { color: t.inkMuted }]}>All time</Text>
              <Text style={[styles.statValue, { color: t.ink, fontFamily: fonts.mono }]}>{data.totals.total_sessions}</Text>
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: t.inkMuted }]}>By exercise</Text>
          <View style={[styles.card, { backgroundColor: t.page2 }]}>
            {data.top_exercises.length === 0 && (
              <Text style={{ color: t.inkMuted, fontSize: 13 }}>Nothing logged this week yet.</Text>
            )}
            {data.top_exercises.map((e) => (
              <View key={e.name} style={styles.barRow}>
                <Text style={[styles.barName, { color: t.ink }]} numberOfLines={1}>{e.name}</Text>
                <View style={{ flex: 1 }}>
                  <ProgressBar pct={(e.volume / maxVolume) * 100} color={t.accent2} />
                </View>
                <Text style={[styles.barAmt, { color: t.inkMuted, fontFamily: fonts.mono }]}>{kg(e.volume)}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { color: t.inkMuted }]}>Recent sessions</Text>
          <View style={[styles.card, { backgroundColor: t.page2 }]}>
            {data.recent.length === 0 && (
              <Text style={{ color: t.inkMuted, fontSize: 13 }}>No sessions yet.</Text>
            )}
            {data.recent.map((s, i) => (
              <View
                key={s.id}
                style={[styles.listRow, { borderColor: t.rule, borderBottomWidth: i === data.recent.length - 1 ? 0 : 1 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.ink, fontSize: 13 }} numberOfLines={1}>{s.name || "Workout"}</Text>
                  <Text style={{ color: t.inkMuted, fontSize: 11 }}>
                    {new Date(s.occurred_on).toLocaleDateString(undefined, { month: "short", day: "numeric" })} ·{" "}
                    {s.set_count} set{s.set_count === 1 ? "" : "s"}
                  </Text>
                </View>
                <Text style={{ color: t.ink, fontFamily: fonts.mono, fontSize: 13 }}>{kg(s.volume)}</Text>
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
  hero: { fontSize: 30, fontWeight: "600", marginTop: 4 },
  statRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  statTile: { flex: 1, borderRadius: 12, padding: 12 },
  statValue: { fontSize: 17, fontWeight: "600", marginTop: 4 },
  sectionLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 22, marginBottom: 8 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  barName: { width: 100, fontSize: 12 },
  barAmt: { fontSize: 11, minWidth: 64, textAlign: "right" },
  listRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
});
