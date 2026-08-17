import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts, CATEGORY_DARK_STEP } from "../theme";
import { api, ApiNotConfiguredError } from "../api";
import { Category } from "../types";
import Dot from "../components/Dot";

const SWATCHES = Object.keys(CATEGORY_DARK_STEP);
const TYPES: Category["type"][] = ["expense", "fixed", "saved", "budget"];

export default function CategoriesScreen() {
  const t = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<Category["type"]>("expense");
  const [color, setColor] = useState(SWATCHES[0]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.categories
      .list()
      .then((cats: Category[]) => {
        setCategories(cats);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiNotConfiguredError ? "Set up your server in More → Settings first." : err.message));
  }, []);

  useFocusEffect(load);

  async function add() {
    if (!name.trim()) return Alert.alert("Give the category a name.");
    setSaving(true);
    try {
      await api.categories.create({ name: name.trim(), type, color, sort_order: categories.length + 1 });
      setName("");
      load();
    } catch (err: any) {
      Alert.alert("Couldn't add category", err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  function remove(c: Category) {
    Alert.alert(`Delete "${c.name}"?`, "This only works if no transactions or fixed bills use it.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.categories.remove(c.id);
            load();
          } catch (err: any) {
            Alert.alert("Couldn't delete", err.message || "Something went wrong.");
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={{ backgroundColor: t.paper }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: t.ink, fontFamily: fonts.display }]}>Categories</Text>

      {error && <Text style={{ color: t.inkMuted, fontSize: 13, marginBottom: 12 }}>{error}</Text>}

      <View style={[styles.card, { backgroundColor: t.page2 }]}>
        {categories.map((c, i) => (
          <View key={c.id} style={[styles.row, { borderColor: t.rule, borderBottomWidth: i === categories.length - 1 ? 0 : 1 }]}>
            <Dot color={t.categoryColor(c.color)} size={12} />
            <Text style={{ flex: 1, color: t.ink, fontSize: 13 }}>{c.name}</Text>
            <Text style={[styles.typeTag, { borderColor: t.rule, color: t.inkMuted }]}>{c.type}</Text>
            <Pressable onPress={() => remove(c)} hitSlop={8}>
              <Ionicons name="trash-outline" size={16} color={t.inkMuted} />
            </Pressable>
          </View>
        ))}
        {categories.length === 0 && !error && <Text style={{ color: t.inkMuted, fontSize: 13 }}>No categories yet.</Text>}
      </View>

      <Text style={[styles.sectionLabel, { color: t.inkMuted }]}>Add category</Text>
      <View style={[styles.card, { backgroundColor: t.page2 }]}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name"
          placeholderTextColor={t.inkMuted}
          style={[styles.input, { borderColor: t.rule, color: t.ink }]}
        />
        <View style={styles.typeRow}>
          {TYPES.map((tp) => (
            <Pressable
              key={tp}
              onPress={() => setType(tp)}
              style={[styles.typeChip, { borderColor: type === tp ? t.accent : t.rule, backgroundColor: type === tp ? t.page : "transparent" }]}
            >
              <Text style={{ color: t.ink, fontSize: 12 }}>{tp}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.swatchRow}>
          {SWATCHES.map((hex) => (
            <Pressable key={hex} onPress={() => setColor(hex)} style={[styles.swatch, { backgroundColor: t.categoryColor(hex), borderColor: color === hex ? t.ink : "transparent" }]} />
          ))}
        </View>
        <Pressable onPress={add} disabled={saving} style={[styles.button, { backgroundColor: t.accent, opacity: saving ? 0.6 : 1 }]}>
          <Text style={{ color: t.accentInk, fontWeight: "600", fontSize: 14 }}>{saving ? "Adding…" : "+ Add category"}</Text>
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
  typeTag: { fontSize: 10, borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  sectionLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 22, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, padding: 11, fontSize: 14 },
  typeRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  typeChip: { borderWidth: 1, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  swatchRow: { flexDirection: "row", gap: 10, marginTop: 14, flexWrap: "wrap" },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2 },
  button: { marginTop: 16, borderRadius: 10, padding: 12, alignItems: "center" },
});
