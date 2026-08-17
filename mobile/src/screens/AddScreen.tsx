import { useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Switch, Alert, Platform } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme, fonts } from "../theme";
import { api, ApiNotConfiguredError } from "../api";
import { Category, CategoryType } from "../types";
import Dot from "../components/Dot";

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

const TYPE_SECTIONS: { type: CategoryType; label: string }[] = [
  { type: "expense", label: "Expense" },
  { type: "fixed", label: "Fixed" },
  { type: "saved", label: "Saved" },
  { type: "budget", label: "Budget" },
];

export default function AddScreen({ navigation }: any) {
  const t = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [isPaid, setIsPaid] = useState(true);
  const [saving, setSaving] = useState(false);

  const byType = useMemo(() => {
    const map = new Map<CategoryType, Category[]>();
    for (const c of categories) {
      if (!map.has(c.type)) map.set(c.type, []);
      map.get(c.type)!.push(c);
    }
    return map;
  }, [categories]);

  useFocusEffect(
    useCallback(() => {
      api
        .categories.list()
        .then((cats: Category[]) => {
          setCategories(cats);
          setError(null);
          setCategoryId((prev) => prev ?? cats.find((c) => c.type === "expense")?.id ?? cats[0]?.id ?? null);
        })
        .catch((err) => setError(err instanceof ApiNotConfiguredError ? "Couldn't reach the server. Pull to refresh, or sign out and back in." : err.message));
    }, [])
  );

  function reset() {
    setAmount("");
    setDescription("");
    setIsPaid(true);
    setDate(new Date());
  }

  async function save() {
    const numAmount = Number(amount);
    if (!categoryId) return Alert.alert("Pick a category first.");
    if (!numAmount || numAmount <= 0) return Alert.alert("Enter an amount greater than 0.");

    setSaving(true);
    try {
      await api.transactions.create({
        category_id: categoryId,
        description,
        amount: numAmount,
        is_paid: isPaid,
        occurred_on: toISODate(date),
      });
      reset();
      navigation.navigate("Home");
    } catch (err: any) {
      Alert.alert("Couldn't save", err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: t.paper }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: t.ink, fontFamily: fonts.display }]}>New entry</Text>

      {error ? (
        <Text style={{ color: t.inkMuted, fontSize: 13 }}>{error}</Text>
      ) : (
        <>
          <View style={styles.amountRow}>
            <Text style={[styles.currency, { color: t.inkMuted, fontFamily: fonts.mono }]}>Rs</Text>
            <TextInput
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ""))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={t.inkMuted}
              style={[styles.amountInput, { color: t.ink, fontFamily: fonts.mono, borderBottomColor: t.accent }]}
            />
          </View>

          <Text style={[styles.label, { color: t.inkMuted }]}>Category</Text>
          {TYPE_SECTIONS.map(({ type, label }) => {
            const cats = byType.get(type) ?? [];
            return (
              <View key={type} style={styles.typeSection}>
                <Text style={[styles.typeLabel, { color: t.inkMuted }]}>{label}</Text>
                {cats.length === 0 ? (
                  <Text style={{ color: t.inkMuted, fontSize: 11.5, fontStyle: "italic" }}>No {label.toLowerCase()} categories yet</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {cats.map((c) => {
                      const selected = c.id === categoryId;
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => setCategoryId(c.id)}
                          style={[
                            styles.chip,
                            {
                              borderColor: selected ? t.accent : t.rule,
                              backgroundColor: selected ? t.page : "transparent",
                            },
                          ]}
                        >
                          <Dot color={t.categoryColor(c.color)} size={7} />
                          <Text style={{ color: t.ink, fontSize: 12, fontWeight: selected ? "600" : "400" }}>{c.name}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            );
          })}

          <Text style={[styles.label, { color: t.inkMuted }]}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What was this for?"
            placeholderTextColor={t.inkMuted}
            style={[styles.field, { borderColor: t.rule, color: t.ink }]}
          />

          <Text style={[styles.label, { color: t.inkMuted }]}>Date</Text>
          <Pressable onPress={() => setShowPicker(true)} style={[styles.field, { borderColor: t.rule }]}>
            <Text style={{ color: t.ink, fontSize: 14 }}>
              {date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            </Text>
          </Pressable>
          {showPicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              onChange={(_, selected) => {
                setShowPicker(Platform.OS === "ios");
                if (selected) setDate(selected);
              }}
            />
          )}

          <View style={styles.switchRow}>
            <Text style={{ color: t.ink, fontSize: 14 }}>Mark as paid</Text>
            <Switch value={isPaid} onValueChange={setIsPaid} trackColor={{ true: t.accent, false: t.rule }} />
          </View>

          <Pressable
            onPress={save}
            disabled={saving}
            style={[styles.button, { backgroundColor: t.accent, opacity: saving ? 0.6 : 1 }]}
          >
            <Text style={{ color: t.accentInk, fontWeight: "600", fontSize: 15 }}>{saving ? "Saving…" : "Save entry"}</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 60 },
  title: { fontSize: 22, marginBottom: 16 },
  amountRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 6, marginBottom: 22 },
  currency: { fontSize: 16, marginBottom: 8 },
  amountInput: { fontSize: 44, fontWeight: "600", borderBottomWidth: 2, minWidth: 140, textAlign: "center", paddingBottom: 4 },
  label: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 16, marginBottom: 8 },
  typeSection: { marginBottom: 10 },
  typeLabel: { fontSize: 11, fontWeight: "600", marginBottom: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 12, marginRight: 8 },
  field: { borderWidth: 1, borderRadius: 10, padding: 12 },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20 },
  button: { marginTop: 28, borderRadius: 10, padding: 14, alignItems: "center" },
});
