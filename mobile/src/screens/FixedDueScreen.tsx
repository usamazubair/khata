import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, RefreshControl, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "../theme";
import { api, currentMonth, money } from "../api";
import { FixedExpense } from "../types";
import Dot from "../components/Dot";

/** Every unpaid active bill this month, as a wrapping grid of chips — pick
 *  one, confirm, done. The bill's category and amount are already fixed by
 *  its own definition, so there's nothing to fill in: this is strictly a
 *  select-then-confirm action, never a form. */
export default function FixedDueScreen({ navigation }: any) {
  const t = useTheme();
  const [bills, setBills] = useState<FixedExpense[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const all: FixedExpense[] = await api.fixedExpenses.list(currentMonth());
      setBills(all.filter((b) => b.active && b.status !== "paid"));
      setError(null);
    } catch (err: any) {
      setError(err.message || "Couldn't load your fixed bills.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setSelectedId(null);
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const selected = bills.find((b) => b.id === selectedId) ?? null;

  async function logSelected() {
    if (!selected) return;
    setSaving(true);
    try {
      await api.fixedExpenses.confirm(selected.id);
      setSelectedId(null);
      await load();
      navigation.navigate("Home");
    } catch (err: any) {
      Alert.alert("Couldn't log that", err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
      >
        <Text style={[styles.title, { color: t.ink, fontFamily: fonts.display }]}>Due this month</Text>
        <Text style={{ color: t.inkMuted, fontSize: 12.5, marginBottom: 18 }}>
          Tap a bill, then confirm below — the amount and category are already set from the bill itself.
        </Text>

        {error && <Text style={{ color: t.inkMuted, fontSize: 13 }}>{error}</Text>}

        {!error && bills.length === 0 && (
          <View style={[styles.empty, { backgroundColor: t.page2 }]}>
            <Ionicons name="checkmark-done-circle-outline" size={28} color={t.inkMuted} />
            <Text style={{ color: t.inkMuted, fontSize: 13, marginTop: 8, textAlign: "center" }}>
              Nothing unpaid this month — you're all caught up.
            </Text>
          </View>
        )}

        <View style={styles.grid}>
          {bills.map((b) => {
            const on = b.id === selectedId;
            return (
              <Pressable
                key={b.id}
                onPress={() => setSelectedId(on ? null : b.id)}
                style={[
                  styles.chip,
                  { borderColor: on ? t.accent : t.rule, backgroundColor: on ? t.page2 : t.page },
                ]}
              >
                <Dot color={t.categoryColor(b.category_color)} size={8} />
                <View>
                  <Text style={{ color: t.ink, fontSize: 13, fontWeight: "600" }}>{b.name}</Text>
                  <Text style={{ color: t.inkMuted, fontSize: 11, fontFamily: fonts.mono, marginTop: 1 }}>
                    {money(b.amount)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {selected && (
        <View style={[styles.bar, { backgroundColor: t.page2, borderColor: t.rule }]}>
          <Pressable
            onPress={logSelected}
            disabled={saving}
            style={[styles.logButton, { backgroundColor: t.accent, opacity: saving ? 0.6 : 1 }]}
          >
            <Text style={{ color: t.accentInk, fontWeight: "600", fontSize: 15 }}>
              {saving ? "Logging…" : `Log ${selected.name} — ${money(selected.amount)}`}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 100 },
  title: { fontSize: 22, marginBottom: 4 },
  empty: { borderRadius: 12, padding: 24, alignItems: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 13 },
  bar: { borderTopWidth: 1, padding: 14, paddingBottom: 22 },
  logButton: { borderRadius: 10, padding: 14, alignItems: "center" },
});
