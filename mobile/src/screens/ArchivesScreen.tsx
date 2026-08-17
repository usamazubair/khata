import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "../theme";
import { api, currentMonth, money, ApiNotConfiguredError } from "../api";
import { Transaction } from "../types";
import Dot from "../components/Dot";

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function ArchivesScreen() {
  const t = useTheme();
  const [months, setMonths] = useState<{ month: string; total: number; count: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<Transaction[] | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useFocusEffect(
    useCallback(() => {
      api
        .summary(currentMonth())
        .then((s) => {
          setMonths(s.archives);
          setError(null);
        })
        .catch((err) => setError(err instanceof ApiNotConfiguredError ? "Set up your server in More → Settings first." : err.message));
    }, [])
  );

  async function toggle(month: string) {
    if (expanded === month) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(month);
    setLoadingDetail(true);
    try {
      const rows = await api.transactions.list({ month });
      setDetail(rows);
    } finally {
      setLoadingDetail(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: t.paper }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: t.ink, fontFamily: fonts.display }]}>Archives</Text>
      <Text style={{ color: t.inkMuted, fontSize: 12, marginBottom: 16 }}>Tap a month to see its ledger.</Text>

      {error && <Text style={{ color: t.inkMuted, fontSize: 13 }}>{error}</Text>}

      <View style={[styles.card, { backgroundColor: t.page2 }]}>
        {months.map((m, i) => (
          <View key={m.month}>
            <Pressable
              onPress={() => toggle(m.month)}
              style={[styles.row, { borderColor: t.rule, borderBottomWidth: expanded === m.month || i === months.length - 1 ? 0 : 1 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.ink, fontSize: 13, fontWeight: "600" }}>{monthLabel(m.month)}</Text>
                <Text style={{ color: t.inkMuted, fontSize: 11 }}>{m.count} entries</Text>
              </View>
              <Text style={{ color: t.ink, fontFamily: fonts.mono, fontSize: 13, marginRight: 6 }}>{money(m.total)}</Text>
              <Ionicons name={expanded === m.month ? "chevron-down" : "chevron-forward"} size={16} color={t.inkMuted} />
            </Pressable>

            {expanded === m.month && (
              <View style={[styles.detail, { borderColor: t.rule }]}>
                {loadingDetail && <ActivityIndicator color={t.accent} />}
                {!loadingDetail &&
                  detail?.map((tx) => (
                    <View key={tx.id} style={styles.detailRow}>
                      <Dot color={t.categoryColor(tx.category_color)} size={7} />
                      <Text style={{ flex: 1, color: t.ink, fontSize: 12 }} numberOfLines={1}>{tx.description || tx.category_name}</Text>
                      <Text style={{ color: t.inkMuted, fontFamily: fonts.mono, fontSize: 11 }}>{money(tx.amount)}</Text>
                    </View>
                  ))}
              </View>
            )}
          </View>
        ))}
        {months.length === 0 && !error && <Text style={{ color: t.inkMuted, fontSize: 13 }}>No earlier months yet.</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 50 },
  title: { fontSize: 22, marginBottom: 4 },
  card: { borderRadius: 12, padding: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  detail: { paddingLeft: 4, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 6 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3 },
});
