import { useCallback, useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "../theme";
import { api, currentMonth, money, ApiNotConfiguredError } from "../api";
import { Budget, Goal } from "../types";
import ProgressBar from "../components/ProgressBar";

// api.budgets.list / api.goals.list already filter to active=true, so
// deactivated budgets/goals never reach this screen.
export default function InsightsScreen() {
  const t = useTheme();
  const [tab, setTab] = useState<"budget" | "goals">("budget");
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [budgetQuery, setBudgetQuery] = useState("");
  const [goalQuery, setGoalQuery] = useState("");
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

  const filteredBudgets = budgets.filter((b) => b.name.toLowerCase().includes(budgetQuery.trim().toLowerCase()));
  const filteredGoals = goals.filter((g) => g.name.toLowerCase().includes(goalQuery.trim().toLowerCase()));

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

        <View style={[styles.searchRow, { borderColor: t.rule, backgroundColor: t.page }]}>
          <Ionicons name="search" size={15} color={t.inkMuted} />
          <TextInput
            value={tab === "budget" ? budgetQuery : goalQuery}
            onChangeText={tab === "budget" ? setBudgetQuery : setGoalQuery}
            placeholder={tab === "budget" ? "Search budgets" : "Search goals"}
            placeholderTextColor={t.inkMuted}
            style={[styles.searchInput, { color: t.ink }]}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {error && <Text style={{ color: t.inkMuted, fontSize: 13 }}>{error}</Text>}

        {!error && tab === "budget" && (
          filteredBudgets.length === 0 ? (
            <Text style={{ color: t.inkMuted, fontSize: 13 }}>
              {budgets.length === 0 ? "No active budgets yet." : "No budgets match your search."}
            </Text>
          ) : (
            filteredBudgets.map((b) => {
              const spent = Number(b.spent);
              const price = Number(b.price);
              const remaining = Number(b.remaining);
              const pct = price > 0 ? (spent / price) * 100 : 0;
              const color = remaining < 0 ? t.status.critical : pct >= 85 ? t.status.warning : t.status.good;
              return (
                <View key={b.id} style={[styles.card, { backgroundColor: t.page2 }]}>
                  <View style={styles.cardTop}>
                    <Text style={{ color: t.ink, fontSize: 13, fontWeight: "600" }}>{b.name}</Text>
                    <Text style={{ color: t.ink, fontFamily: fonts.mono, fontSize: 12 }}>{money(spent)} / {money(price)}</Text>
                  </View>
                  <View style={{ marginTop: 8 }}>
                    <ProgressBar pct={pct} color={color} />
                  </View>
                  <View style={styles.cardTop}>
                    <Text style={{ color: t.inkMuted, fontSize: 11 }}>{b.category_name}</Text>
                    <Text style={{ color, fontSize: 11, fontWeight: "600" }}>
                      {remaining < 0 ? `${money(-remaining)} over` : `${money(remaining)} left`}
                    </Text>
                  </View>
                </View>
              );
            })
          )
        )}

        {!error && tab === "goals" && (
          filteredGoals.length === 0 ? (
            <Text style={{ color: t.inkMuted, fontSize: 13 }}>
              {goals.length === 0 ? "No active savings goals yet." : "No goals match your search."}
            </Text>
          ) : (
            filteredGoals.map((g) => {
              const saved = Number(g.saved);
              const price = Number(g.price);
              const remaining = Number(g.remaining);
              const pct = price > 0 ? (saved / price) * 100 : 0;
              return (
                <View key={g.id} style={[styles.card, { backgroundColor: t.page2 }]}>
                  <View style={styles.cardTop}>
                    <Text style={{ color: t.ink, fontSize: 13, fontWeight: "600" }}>{g.name}</Text>
                    <Text style={{ color: t.ink, fontFamily: fonts.mono, fontSize: 12 }}>{money(saved)} / {money(price)}</Text>
                  </View>
                  <View style={{ marginTop: 8 }}>
                    <ProgressBar pct={pct} color={t.accent2} />
                  </View>
                  <View style={styles.cardTop}>
                    <Text style={{ color: t.inkMuted, fontSize: 11 }}>
                      {g.target_date
                        ? `Target: ${new Date(g.target_date).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`
                        : g.category_name}
                    </Text>
                    <Text style={{ color: remaining <= 0 ? t.status.good : t.inkMuted, fontSize: 11, fontWeight: "600" }}>
                      {remaining <= 0 ? "Funded" : `${money(remaining)} left`}
                    </Text>
                  </View>
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
  searchRow: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10 },
  searchInput: { flex: 1, fontSize: 13, padding: 0 },
  list: { padding: 18, paddingTop: 10, gap: 12 },
  card: { borderRadius: 12, padding: 13 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
});
