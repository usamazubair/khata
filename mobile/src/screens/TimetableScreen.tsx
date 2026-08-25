import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "../theme";
import { api } from "../api";
import { refreshReminders } from "../lib/reminders";
import { TimetableOccurrence } from "../types";
import { WEEKDAY_SHORT, addDays, dayLabel, duration, formatTime, isoDate } from "../lib/schedule";

const HORIZON_DAYS = 14;

/** The next fortnight as an agenda: pick a day along the top, read what's on
 *  it below. Entries themselves are built on the web dashboard. */
export default function TimetableScreen() {
  const t = useTheme();
  const [occurrences, setOccurrences] = useState<TimetableOccurrence[]>([]);
  const [selected, setSelected] = useState(() => isoDate(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setOccurrences(await api.timetable.occurrences(isoDate(new Date()), HORIZON_DAYS));
      setError(null);
    } catch (err: any) {
      setError(err.message || "Couldn't load your timetable.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      // Entries are edited on the web dashboard, so this is the moment that
      // matters most: opening the tab is exactly when you'd want a reminder
      // added five minutes ago on a laptop to actually take effect.
      refreshReminders();
    }, [load])
  );

  const days = useMemo(
    () =>
      Array.from({ length: HORIZON_DAYS }, (_, i) => {
        const d = addDays(new Date(), i);
        return { iso: isoDate(d), dow: d.getDay(), date: d.getDate() };
      }),
    []
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of occurrences) map[o.date] = (map[o.date] ?? 0) + 1;
    return map;
  }, [occurrences]);

  const forDay = occurrences.filter((o) => o.date === selected);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.strip}>
        {days.map((d) => {
          const on = d.iso === selected;
          return (
            <Pressable
              key={d.iso}
              onPress={() => setSelected(d.iso)}
              style={[
                styles.dayPill,
                { borderColor: on ? t.accent : t.rule, backgroundColor: on ? t.accent : t.page2 },
              ]}
            >
              <Text style={{ color: on ? t.accentInk : t.inkMuted, fontSize: 10, letterSpacing: 0.6 }}>
                {WEEKDAY_SHORT[d.dow].toUpperCase()}
              </Text>
              <Text style={{ color: on ? t.accentInk : t.ink, fontSize: 16, fontWeight: "600", fontFamily: fonts.mono }}>
                {d.date}
              </Text>
              <View style={styles.dot}>
                {counts[d.iso] ? (
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: on ? t.accentInk : t.accent }} />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
      >
        <Text style={[styles.heading, { color: t.ink, fontFamily: fonts.display }]}>{dayLabel(selected)}</Text>

        {error && <Text style={{ color: t.inkMuted, fontSize: 13 }}>{error}</Text>}

        {!error && forDay.length === 0 && (
          <View style={[styles.empty, { backgroundColor: t.page2 }]}>
            <Ionicons name="cafe-outline" size={22} color={t.inkMuted} />
            <Text style={{ color: t.inkMuted, fontSize: 13, marginTop: 8 }}>Nothing scheduled.</Text>
          </View>
        )}

        {forDay.map((o) => (
          <View key={`${o.id}-${o.date}`} style={styles.row}>
            <View style={styles.timeRail}>
              <Text style={{ color: t.ink, fontSize: 12.5, fontFamily: fonts.mono }}>{formatTime(o.starts_at)}</Text>
              <Text style={{ color: t.inkMuted, fontSize: 10.5, fontFamily: fonts.mono }}>{formatTime(o.ends_at)}</Text>
            </View>

            <View
              style={[
                styles.card,
                { backgroundColor: t.page2, borderLeftColor: t.categoryColor(o.color), borderLeftWidth: 3 },
              ]}
            >
              <Text style={{ color: t.ink, fontSize: 14.5, fontWeight: "600" }}>{o.title}</Text>
              <View style={styles.meta}>
                <Text style={{ color: t.inkMuted, fontSize: 11.5 }}>{duration(o.starts_at, o.ends_at)}</Text>
                {!!o.location && (
                  <>
                    <Text style={{ color: t.inkMuted, fontSize: 11.5 }}>·</Text>
                    <Ionicons name="location-outline" size={11} color={t.inkMuted} />
                    <Text style={{ color: t.inkMuted, fontSize: 11.5 }}>{o.location}</Text>
                  </>
                )}
                {o.remind_minutes !== null && (
                  <>
                    <Text style={{ color: t.inkMuted, fontSize: 11.5 }}>·</Text>
                    <Ionicons name="notifications-outline" size={11} color={t.accent} />
                  </>
                )}
                {!o.event_date && <Ionicons name="repeat" size={12} color={t.inkMuted} style={{ marginLeft: "auto" }} />}
              </View>
              {!!o.notes && (
                <Text style={{ color: t.inkMuted, fontSize: 12, marginTop: 6 }}>{o.notes}</Text>
              )}
            </View>
          </View>
        ))}

        <Text style={{ color: t.inkMuted, fontSize: 11, textAlign: "center", marginTop: 22 }}>
          Entries are added and edited on the web dashboard.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  dayPill: { borderWidth: 1, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12, alignItems: "center", minWidth: 52 },
  dot: { height: 6, justifyContent: "center", marginTop: 3 },
  container: { padding: 18, paddingTop: 4, paddingBottom: 50 },
  heading: { fontSize: 22, marginBottom: 14 },
  empty: { borderRadius: 12, padding: 24, alignItems: "center" },
  row: { flexDirection: "row", gap: 12, marginBottom: 10 },
  timeRail: { width: 58, paddingTop: 12, alignItems: "flex-end" },
  card: { flex: 1, borderRadius: 12, padding: 13 },
  meta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 },
});
