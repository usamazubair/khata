import { useCallback, useMemo, useState } from "react";
import { View, Text, SectionList, StyleSheet, Pressable, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme, fonts } from "../theme";
import { api, currentMonth, money, ApiNotConfiguredError } from "../api";
import { Transaction } from "../types";
import Dot from "../components/Dot";

type Filter = "all" | "month" | "unpaid";

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export default function TransactionsScreen() {
  const t = useTheme();
  const [items, setItems] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (f: Filter) => {
    const params: Record<string, string> = {};
    if (f === "month") params.month = currentMonth();
    if (f === "unpaid") params.paid = "false";
    try {
      const rows = await api.transactions.list(params);
      setItems(rows);
      setError(null);
    } catch (err: any) {
      setError(err instanceof ApiNotConfiguredError ? "Set up your server in More → Settings first." : err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(filter);
    }, [load, filter])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load(filter);
    setRefreshing(false);
  }

  const sections = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    for (const tx of items) {
      const label = dayLabel(tx.occurred_on);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(tx);
    }
    return Array.from(groups, ([title, data]) => ({ title, data }));
  }, [items]);

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <View style={styles.filterRow}>
        {(["all", "month", "unpaid"] as Filter[]).map((f) => {
          const selected = f === filter;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.chip, { borderColor: selected ? t.accent : t.rule, backgroundColor: selected ? t.page : "transparent" }]}
            >
              <Text style={{ color: t.ink, fontSize: 12, fontWeight: selected ? "600" : "400" }}>
                {f === "all" ? "All" : f === "month" ? "This month" : "Unpaid"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error && <Text style={{ color: t.inkMuted, fontSize: 13, paddingHorizontal: 18 }}>{error}</Text>}

      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 18, paddingTop: 4 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
        renderSectionHeader={({ section }) => (
          <Text style={[styles.sectionLabel, { color: t.inkMuted }]}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <View style={[styles.row, { borderColor: t.rule }]}>
            <Dot color={t.categoryColor(item.category_color)} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.ink, fontSize: 13 }} numberOfLines={1}>{item.description || item.category_name}</Text>
              <Text style={{ color: t.inkMuted, fontSize: 11 }}>{item.category_name}{!item.is_paid ? " · Unpaid" : ""}</Text>
            </View>
            <Text style={{ color: t.ink, fontFamily: fonts.mono, fontSize: 13 }}>{money(item.amount)}</Text>
          </View>
        )}
        ListEmptyComponent={!error ? <Text style={{ color: t.inkMuted, fontSize: 13 }}>Nothing here yet.</Text> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6 },
  chip: { borderWidth: 1, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 12 },
  sectionLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 16, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
});
