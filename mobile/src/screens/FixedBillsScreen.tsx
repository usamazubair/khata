import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme, fonts } from "../theme";
import { api, currentMonth, money, ApiNotConfiguredError } from "../api";
import { Category, FixedExpense } from "../types";
import Dot from "../components/Dot";

function effectiveStatus(bill: FixedExpense): "paid" | "due" | "overdue" {
  if (bill.status === "paid") return "paid";
  const today = new Date().getDate();
  return bill.due_day < today ? "overdue" : "due";
}

export default function FixedBillsScreen() {
  const t = useTheme();
  const [bills, setBills] = useState<FixedExpense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("1");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    Promise.all([api.fixedExpenses.list(currentMonth()), api.categories.list()])
      .then(([b, c]) => {
        setBills(b);
        setCategories(c);
        setCategoryId((prev) => prev ?? c[0]?.id ?? null);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiNotConfiguredError ? "Set up your server in More → Settings first." : err.message));
  }, []);

  useFocusEffect(load);

  function confirm(bill: FixedExpense) {
    Alert.alert(`Log ${bill.name}?`, `Records ${money(bill.amount)} against today's date.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log it",
        onPress: async () => {
          try {
            await api.fixedExpenses.confirm(bill.id);
            load();
          } catch (err: any) {
            Alert.alert("Couldn't log it", err.message || "Something went wrong.");
          }
        },
      },
    ]);
  }

  async function add() {
    const numAmount = Number(amount);
    const numDueDay = Number(dueDay);
    if (!name.trim() || !categoryId || !numAmount || !numDueDay) {
      return Alert.alert("Fill in name, category, amount, and due day.");
    }
    setSaving(true);
    try {
      await api.fixedExpenses.create({ name: name.trim(), category_id: categoryId, amount: numAmount, due_day: numDueDay });
      setName("");
      setAmount("");
      setDueDay("1");
      load();
    } catch (err: any) {
      Alert.alert("Couldn't add", err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const statusColor = { paid: t.status.good, due: t.status.warning, overdue: t.status.critical };
  const statusLabel = { paid: "Paid", due: "Due", overdue: "Overdue" };

  return (
    <ScrollView style={{ backgroundColor: t.paper }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: t.ink, fontFamily: fonts.display }]}>Fixed bills</Text>

      {error && <Text style={{ color: t.inkMuted, fontSize: 13, marginBottom: 12 }}>{error}</Text>}

      <View style={[styles.card, { backgroundColor: t.page2 }]}>
        {bills.map((bill, i) => {
          const s = effectiveStatus(bill);
          return (
            <Pressable
              key={bill.id}
              onPress={() => s !== "paid" && confirm(bill)}
              style={[styles.row, { borderColor: t.rule, borderBottomWidth: i === bills.length - 1 ? 0 : 1 }]}
            >
              <Dot color={t.categoryColor(bill.category_color)} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.ink, fontSize: 13 }}>{bill.name}</Text>
                <Text style={{ color: t.inkMuted, fontSize: 11 }}>Due on the {bill.due_day}{bill.due_day === 1 ? "st" : bill.due_day === 2 ? "nd" : bill.due_day === 3 ? "rd" : "th"}</Text>
              </View>
              <Text style={{ color: t.ink, fontFamily: fonts.mono, fontSize: 12, marginRight: 8 }}>{money(bill.amount)}</Text>
              <Text style={[styles.statusChip, { color: statusColor[s], backgroundColor: statusColor[s] + "26" }]}>{statusLabel[s]}</Text>
            </Pressable>
          );
        })}
        {bills.length === 0 && !error && <Text style={{ color: t.inkMuted, fontSize: 13 }}>No fixed bills yet.</Text>}
      </View>

      <Text style={[styles.sectionLabel, { color: t.inkMuted }]}>Add fixed bill</Text>
      <View style={[styles.card, { backgroundColor: t.page2 }]}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name (e.g. Internet - ptcl)"
          placeholderTextColor={t.inkMuted}
          style={[styles.input, { borderColor: t.rule, color: t.ink }]}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          {categories.map((c) => {
            const selected = c.id === categoryId;
            return (
              <Pressable
                key={c.id}
                onPress={() => setCategoryId(c.id)}
                style={[styles.typeChip, { borderColor: selected ? t.accent : t.rule, backgroundColor: selected ? t.page : "transparent" }]}
              >
                <Dot color={t.categoryColor(c.color)} size={7} />
                <Text style={{ color: t.ink, fontSize: 12, marginLeft: 6 }}>{c.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.inline}>
          <TextInput
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ""))}
            placeholder="Amount"
            keyboardType="decimal-pad"
            placeholderTextColor={t.inkMuted}
            style={[styles.input, { flex: 1, borderColor: t.rule, color: t.ink }]}
          />
          <TextInput
            value={dueDay}
            onChangeText={(v) => setDueDay(v.replace(/[^0-9]/g, ""))}
            placeholder="Due day"
            keyboardType="number-pad"
            placeholderTextColor={t.inkMuted}
            style={[styles.input, { width: 90, borderColor: t.rule, color: t.ink }]}
          />
        </View>
        <Pressable onPress={add} disabled={saving} style={[styles.button, { backgroundColor: t.accent, opacity: saving ? 0.6 : 1 }]}>
          <Text style={{ color: t.accentInk, fontWeight: "600", fontSize: 14 }}>{saving ? "Adding…" : "+ Add fixed bill"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 50 },
  title: { fontSize: 22, marginBottom: 16 },
  card: { borderRadius: 12, padding: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  statusChip: { fontSize: 10, fontFamily: "monospace", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20, overflow: "hidden" },
  sectionLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 22, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, padding: 11, fontSize: 14 },
  inline: { flexDirection: "row", gap: 10, marginTop: 10 },
  typeChip: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 12, marginRight: 8 },
  button: { marginTop: 16, borderRadius: 10, padding: 12, alignItems: "center" },
});
