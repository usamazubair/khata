import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "../theme";
import { refreshReminders, getScheduledNotifications } from "../lib/reminders";
import { getLoggedNotifications, type LoggedNotification } from "../lib/notificationLog";

type Scheduled = { id: string; title: string; body: string; when: Date | null };

/** A DateTriggerInput's `date` can come back as a Date, an epoch number, or
 *  — on some Android builds — not round-trip in a shape expo-notifications
 *  recognises at all ("unknown" trigger). Anything unreadable still shows
 *  up, just without a time, rather than being silently dropped. */
function triggerDate(trigger: unknown): Date | null {
  if (!trigger || typeof trigger !== "object") return null;
  const t = trigger as { date?: string | number | Date };
  if (t.date === undefined) return null;
  const d = t.date instanceof Date ? t.date : new Date(t.date);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function NotificationsScreen() {
  const t = useTheme();
  const [scheduled, setScheduled] = useState<Scheduled[]>([]);
  const [recent, setRecent] = useState<LoggedNotification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    const [requests, log] = await Promise.all([getScheduledNotifications(), getLoggedNotifications()]);
    const items = requests
      .map((r) => ({
        id: r.identifier,
        title: r.content.title ?? "Reminder",
        body: r.content.body ?? "",
        when: triggerDate(r.trigger),
      }))
      .sort((a, b) => {
        if (a.when && b.when) return a.when.getTime() - b.when.getTime();
        return a.when ? -1 : b.when ? 1 : 0;
      });
    setScheduled(items);
    setRecent(log);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function syncNow() {
    setSyncing(true);
    await refreshReminders();
    await load();
    setSyncing(false);
  }

  return (
    <ScrollView
      style={{ backgroundColor: t.paper }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
    >
      <View style={styles.headRow}>
        <Text style={[styles.title, { color: t.ink, fontFamily: fonts.display }]}>Notifications</Text>
        <Pressable onPress={syncNow} disabled={syncing} style={[styles.syncButton, { borderColor: t.rule }]}>
          <Ionicons name="sync-outline" size={14} color={t.inkMuted} />
          <Text style={{ color: t.inkMuted, fontSize: 12 }}>{syncing ? "Syncing…" : "Sync now"}</Text>
        </Pressable>
      </View>

      <Text style={[styles.sectionLabel, { color: t.inkMuted }]}>Scheduled ({scheduled.length})</Text>
      <Text style={{ color: t.inkMuted, fontSize: 11.5, marginBottom: 10, lineHeight: 16 }}>
        Everything currently armed with your phone — this is accurate regardless of whether Khata is open,
        so it's the real answer to "is my reminder actually set."
      </Text>
      <View style={[styles.card, { backgroundColor: t.page2 }]}>
        {scheduled.length === 0 && (
          <Text style={{ color: t.inkMuted, fontSize: 13 }}>
            Nothing scheduled. Turn a reminder on in Settings, or tap Sync now if you expected something here.
          </Text>
        )}
        {scheduled.map((s, i) => (
          <View
            key={s.id}
            style={[styles.row, { borderColor: t.rule, borderBottomWidth: i === scheduled.length - 1 ? 0 : 1 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.ink, fontSize: 13.5, fontWeight: "600" }} numberOfLines={1}>{s.title}</Text>
              {!!s.body && <Text style={{ color: t.inkMuted, fontSize: 11.5, marginTop: 2 }} numberOfLines={2}>{s.body}</Text>}
            </View>
            <Text style={{ color: t.inkMuted, fontSize: 11, fontFamily: fonts.mono, textAlign: "right" }}>
              {s.when
                ? s.when.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                : "—"}
            </Text>
          </View>
        ))}
      </View>

      <Text style={[styles.sectionLabel, { color: t.inkMuted }]}>Recently delivered</Text>
      <Text style={{ color: t.inkMuted, fontSize: 11.5, marginBottom: 10, lineHeight: 16 }}>
        Only what Khata was open (or freshly backgrounded) to see — a notification that fires while it's
        fully closed still reaches your phone, it just won't show up in this list.
      </Text>
      <View style={[styles.card, { backgroundColor: t.page2 }]}>
        {recent.length === 0 && <Text style={{ color: t.inkMuted, fontSize: 13 }}>Nothing logged yet.</Text>}
        {recent.map((r, i) => (
          <View
            key={r.id}
            style={[styles.row, { borderColor: t.rule, borderBottomWidth: i === recent.length - 1 ? 0 : 1 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.ink, fontSize: 13.5, fontWeight: "600" }} numberOfLines={1}>{r.title}</Text>
              {!!r.body && <Text style={{ color: t.inkMuted, fontSize: 11.5, marginTop: 2 }} numberOfLines={2}>{r.body}</Text>}
            </View>
            <Text style={{ color: t.inkMuted, fontSize: 11, fontFamily: fonts.mono, textAlign: "right" }}>
              {new Date(r.receivedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 40 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  title: { fontSize: 22 },
  syncButton: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 11 },
  sectionLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 6, marginBottom: 4 },
  card: { borderRadius: 14, paddingHorizontal: 14, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11 },
});
