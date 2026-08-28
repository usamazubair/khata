import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "../theme";
import { useKeyboardClearance } from "../lib/useKeyboardOffset";
import { Category, CategoryType } from "../types";
import Dot from "./Dot";

const TYPE_ORDER: CategoryType[] = ["expense", "fixed", "saved", "budget"];
const TYPE_LABELS: Record<CategoryType, string> = { expense: "Expense", fixed: "Fixed", saved: "Saved", budget: "Budget" };

/** Multi-select category picker, grouped by type -- reached from the "+"
 *  button on Transactions so entries can be filtered to any mix of
 *  categories at once, not just one type. */
export default function CategoryFilterModal({
  visible,
  categories,
  selected,
  onChange,
  onClose,
}: {
  visible: boolean;
  categories: Category[];
  selected: number[];
  onChange: (ids: number[]) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useKeyboardClearance(insets);

  function toggle(id: number) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingBottom: bottomPad }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: t.page }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: t.ink, fontFamily: fonts.display }]}>Filter by category</Text>
            {selected.length > 0 && (
              <Pressable onPress={() => onChange([])} hitSlop={8}>
                <Text style={{ color: t.accent, fontSize: 12.5 }}>Clear</Text>
              </Pressable>
            )}
          </View>

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {TYPE_ORDER.map((type) => {
              const inType = categories.filter((c) => c.type === type);
              if (!inType.length) return null;
              return (
                <View key={type} style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: t.inkMuted }]}>{TYPE_LABELS[type]}</Text>
                  {inType.map((c) => {
                    const checked = selected.includes(c.id);
                    return (
                      <Pressable key={c.id} onPress={() => toggle(c.id)} style={styles.row}>
                        <View
                          style={[
                            styles.box,
                            { borderColor: checked ? t.accent : t.rule, backgroundColor: checked ? t.accent : "transparent" },
                          ]}
                        >
                          {checked && <Ionicons name="checkmark" size={13} color={t.accentInk} />}
                        </View>
                        <Dot color={t.categoryColor(c.color)} />
                        <Text style={{ color: t.ink, fontSize: 14, flex: 1 }}>{c.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>

          <Pressable onPress={onClose} style={[styles.doneButton, { backgroundColor: t.accent }]}>
            <Text style={{ color: t.accentInk, fontWeight: "600", fontSize: 14 }}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  title: { fontSize: 19 },
  section: { marginBottom: 12 },
  sectionLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
  box: { width: 19, height: 19, borderRadius: 5, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  doneButton: { marginTop: 8, borderRadius: 10, padding: 13, alignItems: "center" },
});
