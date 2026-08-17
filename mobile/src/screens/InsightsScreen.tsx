import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme, fonts } from "../theme";
import { api, currentMonth, money, ApiNotConfiguredError } from "../api";
import { Budget, Goal } from "../types";
import ProgressBar from "../components/ProgressBar";

export default function InsightsScreen() {
  const t = useTheme();
  const [tab, setTab] = useState<"budget" | "goals">("budget");
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([api.budgets.list(currentMonth()), api.goals.list()])
        .then(([b, g]) => {
          setBudgets(b);
          setGoals(g);
          setError(null);
        })
        .catch((err) => setError(err instanceof ApiNotConfiguredError ? "Set up your server in More → Settings first." : err.message));
    }, [])
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.ink, fontFamily: fonts.display }]}>Insights</Text>
        <View style={[styles.segmented, { backgroundColor: t.page2 }]}>
          {(["budget", "goals"] as const).map((k) => (
            <Pressable key={k} onPress={() => setTab(k)} style={[styles.segment, tab === k && { backgroundColor: t.page }]}>
              <Text style={{ color: t.ink, fontSize: 12, fontWeight: tab === k ? "600" : "400" }}>
                {k === "budget" ? "Budget" : "Goals"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {error && <Text style={{ color: t.inkMuted, fontSize: 13 }}>{error}</Text>}

        {!error && tab === "budget" && (
          budgets.length === 0 ? (
            <Text style={{ color: t.inkMuted, fontSize: 13 }}>No budgets set for this month yet.</Text>
          ) : (
            budgets.map((b) => {
              const spent = Number(b.spent);
              const limit = Number(b.limit_amount);
              const pct = limit > 0 ? (spent / limit) * 100 : 0;
              const color = pct >= 100 ? t.status.critical : pct >= 85 ? t.status.warning : t.status.good;
              return (
                <View key={b.id} style={[styles.card, { backgroundColor: t.page2 }]}>
                  <View style={styles.cardTop}>
                    <Text style={{ color: t.ink, fontSize: 13 }}>{b.category_name}</Text>
                    <Text style={{ color: t.ink, fontFamily: fonts.mono, fontSize: 12 }}>{money(spent)} / {money(limit)}</Text>
                  </View>
                  <View style={{ marginTop: 8 }}>
                    <ProgressBar pct={pct} color={color} />
                  </View>
                  <Text style={{ color: t.inkMuted, fontSize: 11, marginTop: 6 }}>
                    {pct >= 100 ? `Over budget by ${money(spent - limit)}` : `${Math.round(pct)}% used`}
                  </Text>
                </View>
              );
            })
          )
        )}

        {!error && tab === "goals" && (
          goals.length === 0 ? (
            <Text style={{ color: t.inkMuted, fontSize: 13 }}>No savings goals yet.</Text>
          ) : (
            goals.map((g) => {
              const saved = Number(g.saved_amount);
              const target = Number(g.target_amount);
              const pct = target > 0 ? (saved / target) * 100 : 0;
              return (
                <View key={g.id} style={[styles.card, { backgroundColor: t.page2 }]}>
                  <Text style={{ color: t.ink, fontSize: 13, fontWeight: "600" }}>{g.name}</Text>
                  <View style={{ marginTop: 8 }}>
                    <ProgressBar pct={pct} color={t.accent2} />
                  </View>
                  <View style={styles.cardTop}>
                    <Text style={{ color: t.ink, fontFamily: fonts.mono, fontSize: 11, fontWeight: "600" }}>{money(saved)} saved</Text>
                    <Text style={{ color: t.inkMuted, fontFamily: fonts.mono, fontSize: 11 }}>of {money(target)}</Text>
                  </View>
                  {g.target_date && (
                    <Text style={{ color: t.inkMuted, fontSize: 10, marginTop: 4 }}>
                      Target: {new Date(g.target_date).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                    </Text>
                  )}
                </View>
              );
            })
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: 18, paddingBottom: 4 },
  title: { fontSize: 22, marginBottom: 12 },
  segmented: { flexDirection: "row", borderRadius: 8, padding: 3, gap: 3 },
  segment: { flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: 6 },
  list: { padding: 18, paddingTop: 10, gap: 12 },
  card: { borderRadius: 12, padding: 13 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
});
