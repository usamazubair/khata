import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, SectionList, StyleSheet, Pressable, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "../theme";
import { api, currentMonth, money, ApiNotConfiguredError } from "../api";
import { Transaction } from "../types";
import Dot from "../components/Dot";

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

// Always scoped to the current month — Transactions is meant for "what's
// happened lately," not a full-history browser.
export default function TransactionsScreen() {
  const t = useTheme();
  const [items, setItems] = useState<Transaction[]>([]);
  const [query, setQuery] = useState("");
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string, unpaid: boolean) => {
    const params: Record<string, string> = { month: currentMonth() };
    if (unpaid) params.paid = "false";
    if (q.trim()) params.q = q.trim();
    try {
      const rows = await api.transactions.list(params);
      setItems(rows);
      setError(null);
    } catch (err: any) {
      setError(err instanceof ApiNotConfiguredError ? "Couldn't reach the server. Pull to refresh, or sign out and back in." : err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(query, unpaidOnly);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, unpaidOnly])
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(query, unpaidOnly), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function onRefresh() {
    setRefreshing(true);
    await load(query, unpaidOnly);
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
      <View style={styles.header}>
        <View style={[styles.searchRow, { borderColor: t.rule, backgroundColor: t.page }]}>
          <Ionicons name="search" size={15} color={t.inkMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search this month's transactions"
            placeholderTextColor={t.inkMuted}
            style={[styles.searchInput, { color: t.ink }]}
          />
        </View>
        <Pressable
          onPress={() => setUnpaidOnly((v) => !v)}
          style={[styles.chip, { borderColor: unpaidOnly ? t.accent : t.rule, backgroundColor: unpaidOnly ? t.page : "transparent" }]}
        >
          <Text style={{ color: t.ink, fontSize: 12, fontWeight: unpaidOnly ? "600" : "400" }}>Unpaid only</Text>
        </Pressable>
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
        ListEmptyComponent={!error ? <Text style={{ color: t.inkMuted, fontSize: 13, paddingHorizontal: 18 }}>Nothing here yet.</Text> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", gap: 8, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6 },
  searchRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 13, padding: 0 },
  chip: { borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 12, justifyContent: "center" },
  sectionLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 16, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
});
