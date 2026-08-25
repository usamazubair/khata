import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "../theme";
import { api, currentMonth, money } from "../api";
import { refreshReminders } from "../lib/reminders";
import { getPending } from "../lib/smsQueue";
import { Summary } from "../types";
import Dot from "../components/Dot";
import ProgressBar from "../components/ProgressBar";

export default function HomeScreen({ navigation }: any) {
  const t = useTheme();
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingSms, setPendingSms] = useState(0);

  const load = useCallback(async () => {
    try {
      const summary = await api.summary(currentMonth());
      setData(summary);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Couldn't load data.");
    }
    setPendingSms((await getPending()).length);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      // Fixed bills are edited on the web dashboard, so opening Home is a
      // natural moment to catch a bill added there and pick up its reminder.
      refreshReminders();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const maxCat = data?.by_category.length ? Math.max(...data.by_category.map((c) => c.total)) : 1;

  return (
    <ScrollView
      style={{ backgroundColor: t.paper }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
    >
      <Text style={[styles.wordmark, { color: t.ink, fontFamily: fonts.display }]}>Khata</Text>

      <Pressable
        onPress={() => navigation.navigate("SmsReview")}
        style={[
          styles.banner,
          pendingSms > 0
            ? { backgroundColor: t.accent }
            : { backgroundColor: "transparent", borderWidth: 1, borderColor: t.rule },
        ]}
      >
        <Ionicons name="clipboard-outline" size={18} color={pendingSms > 0 ? t.accentInk : t.inkMuted} />
        <Text style={{ color: pendingSms > 0 ? t.accentInk : t.inkMuted, fontSize: 13, fontWeight: "600", flex: 1 }}>
          {pendingSms > 0 ? `${pendingSms} waiting to be logged from SMS` : "Log a transaction from SMS"}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={pendingSms > 0 ? t.accentInk : t.inkMuted} />
      </Pressable>

      {error && (
        <View style={[styles.card, { backgroundColor: t.page2 }]}>
          <Text style={{ color: t.inkMuted, fontSize: 13 }}>{error}</Text>
        </View>
      )}

      {data && (
        <>
          <View style={[styles.card, { backgroundColor: t.page2 }]}>
            <Text style={[styles.label, { color: t.inkMuted }]}>Spent this month</Text>
            <Text style={[styles.hero, { color: t.ink, fontFamily: fonts.mono }]}>{money(data.total_expense)}</Text>
          </View>

          <View style={styles.statRow}>
            <View style={[styles.statTile, { backgroundColor: t.page2 }]}>
              <Text style={[styles.label, { color: t.inkMuted }]}>Total saved</Text>
              <Text style={[styles.statValue, { color: t.status.good, fontFamily: fonts.mono }]}>{money(data.total_saved)}</Text>
            </View>
            <View style={[styles.statTile, { backgroundColor: t.page2 }]}>
              <Text style={[styles.label, { color: t.inkMuted }]}>Categories</Text>
              <Text style={[styles.statValue, { color: t.ink, fontFamily: fonts.mono }]}>{data.total_categories}</Text>
            </View>
            <View style={[styles.statTile, { backgroundColor: t.page2 }]}>
              <Text style={[styles.label, { color: t.inkMuted }]}>Transactions</Text>
              <Text style={[styles.statValue, { color: t.ink, fontFamily: fonts.mono }]}>{data.total_transactions}</Text>
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: t.inkMuted, borderColor: t.rule }]}>By category</Text>
          <View style={[styles.card, { backgroundColor: t.page2 }]}>
            {data.by_category.length === 0 && <Text style={{ color: t.inkMuted, fontSize: 13 }}>No spending yet this month.</Text>}
            {data.by_category.map((c) => (
              <View key={c.category_id} style={styles.barRow}>
                <Dot color={t.categoryColor(c.color)} />
                <Text style={[styles.barName, { color: t.ink }]} numberOfLines={1}>{c.name}</Text>
                <View style={{ flex: 1 }}>
                  <ProgressBar pct={(c.total / maxCat) * 100} color={t.categoryColor(c.color)} />
                </View>
                <Text style={[styles.barAmt, { color: t.inkMuted, fontFamily: fonts.mono }]}>{money(c.total)}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { color: t.inkMuted, borderColor: t.rule }]}>Recent</Text>
          <View style={[styles.card, { backgroundColor: t.page2 }]}>
            {data.recent.length === 0 && <Text style={{ color: t.inkMuted, fontSize: 13 }}>No transactions yet.</Text>}
            {data.recent.map((tx, i) => (
              <View key={tx.id} style={[styles.listRow, { borderColor: t.rule, borderBottomWidth: i === data.recent.length - 1 ? 0 : 1 }]}>
                <Dot color={t.categoryColor(tx.category_color)} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.ink, fontSize: 13 }} numberOfLines={1}>{tx.description || tx.category_name}</Text>
                  <Text style={{ color: t.inkMuted, fontSize: 11 }}>
                    {tx.category_name}{!tx.is_paid ? " · Unpaid" : ""}
                  </Text>
                </View>
                <Text style={{ color: t.ink, fontFamily: fonts.mono, fontSize: 13 }}>{money(tx.amount)}</Text>
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
  wordmark: { fontSize: 30, marginBottom: 16 },
  card: { borderRadius: 14, padding: 15 },
  banner: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 13, marginBottom: 14 },
  label: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6 },
  hero: { fontSize: 32, fontWeight: "600", marginTop: 4 },
  caption: { fontSize: 12, marginTop: 8 },
  statRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  statTile: { flex: 1, borderRadius: 12, padding: 12 },
  statValue: { fontSize: 17, fontWeight: "600", marginTop: 4 },
  sectionLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 22, marginBottom: 8 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  barName: { width: 90, fontSize: 12 },
  barAmt: { fontSize: 11, minWidth: 64, textAlign: "right" },
  listRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
});
