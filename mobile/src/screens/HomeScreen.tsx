import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme, fonts } from "../theme";
import { api, currentMonth, money, ApiNotConfiguredError } from "../api";
import { Summary } from "../types";
import Dot from "../components/Dot";
import ProgressBar from "../components/ProgressBar";

export default function HomeScreen({ navigation }: any) {
  const t = useTheme();
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const summary = await api.summary(currentMonth());
      setData(summary);
      setError(null);
    } catch (err: any) {
      if (err instanceof ApiNotConfiguredError) {
        setError("Set up your server in More → Settings first.");
      } else {
        setError(err.message || "Couldn't load data.");
      }
    }
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

  const budgetPct = data && data.budget_total > 0 ? Math.round((data.total_spent / data.budget_total) * 100) : 0;
  const budgetColor = budgetPct >= 100 ? t.status.critical : budgetPct >= 85 ? t.status.warning : t.accent2;
  const maxCat = data?.by_category.length ? Math.max(...data.by_category.map((c) => c.total)) : 1;

  return (
    <ScrollView
      style={{ backgroundColor: t.paper }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
    >
      <Text style={[styles.wordmark, { color: t.ink, fontFamily: fonts.display }]}>Khata</Text>

      {error && (
        <View style={[styles.card, { backgroundColor: t.page2 }]}>
          <Text style={{ color: t.inkMuted, fontSize: 13 }}>{error}</Text>
        </View>
      )}

      {data && (
        <>
          <View style={[styles.card, { backgroundColor: t.page2 }]}>
            <Text style={[styles.label, { color: t.inkMuted }]}>Spent this month</Text>
            <Text style={[styles.hero, { color: t.ink, fontFamily: fonts.mono }]}>{money(data.total_spent)}</Text>
            {data.budget_total > 0 ? (
              <>
                <View style={{ marginTop: 10 }}>
                  <ProgressBar pct={budgetPct} color={budgetColor} />
                </View>
                <Text style={[styles.caption, { color: t.inkMuted }]}>
                  {data.total_spent <= data.budget_total
                    ? `${money(data.budget_total - data.total_spent)} left of ${money(data.budget_total)}`
                    : `${money(data.total_spent - data.budget_total)} over the ${money(data.budget_total)} budget`}
                </Text>
              </>
            ) : (
              <Text style={[styles.caption, { color: t.inkMuted }]}>No budget set for this month.</Text>
            )}
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
  label: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6 },
  hero: { fontSize: 32, fontWeight: "600", marginTop: 4 },
  caption: { fontSize: 12, marginTop: 8 },
  sectionLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 22, marginBottom: 8 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  barName: { width: 90, fontSize: 12 },
  barAmt: { fontSize: 11, minWidth: 64, textAlign: "right" },
  listRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
});
