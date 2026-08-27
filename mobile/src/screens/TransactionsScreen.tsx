import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, SectionList, StyleSheet, Pressable, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "../theme";
import { api, currentMonth, money } from "../api";
import { isoDate } from "../lib/schedule";
import { Transaction } from "../types";
import Dot from "../components/Dot";

const SCOPES = ["All", "Today"] as const;
type Scope = (typeof SCOPES)[number];

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

// "All" still means this month, not full history — Transactions is meant
// for "what's happened lately," not a full-history browser. "Today"
// narrows that down further, to just today.
export default function TransactionsScreen() {
  const t = useTheme();
  const [items, setItems] = useState<Transaction[]>([]);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("All");
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string, unpaid: boolean, sc: Scope) => {
    const params: Record<string, string> =
      sc === "Today" ? { date_from: isoDate(new Date()), date_to: isoDate(new Date()) } : { month: currentMonth() };
    if (unpaid) params.paid = "false";
    if (q.trim()) params.q = q.trim();
    try {
      const rows = await api.transactions.list(params);
      setItems(rows);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(query, unpaidOnly, scope);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, unpaidOnly, scope])
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(query, unpaidOnly, scope), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function onRefresh() {
    setRefreshing(true);
    await load(query, unpaidOnly, scope);
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
        <View style={[styles.scopeRow, { backgroundColor: t.page2 }]}>
          {SCOPES.map((sc) => (
            <Pressable
              key={sc}
              onPress={() => setScope(sc)}
              style={[styles.scopeSeg, scope === sc && { backgroundColor: t.page }]}
            >
              <Text style={{ color: t.ink, fontSize: 12.5, fontWeight: scope === sc ? "600" : "400" }}>{sc}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.searchAndFilterRow}>
          <View style={[styles.searchRow, { borderColor: t.rule, backgroundColor: t.page }]}>
            <Ionicons name="search" size={15} color={t.inkMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={scope === "Today" ? "Search today's transactions" : "Search this month's transactions"}
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
  header: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6, gap: 8 },
  scopeRow: { flexDirection: "row", borderRadius: 10, padding: 3, gap: 3 },
  scopeSeg: { flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: 7 },
  searchAndFilterRow: { flexDirection: "row", gap: 8 },
  searchRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 13, padding: 0 },
  chip: { borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 12, justifyContent: "center" },
  sectionLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 16, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
});
