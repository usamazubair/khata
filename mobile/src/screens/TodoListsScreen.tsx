import { useCallback, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, RefreshControl, Modal, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "../theme";
import { api } from "../api";
import { TodoList } from "../types";
import { EVENT_COLORS } from "../lib/schedule";
import ProgressBar from "../components/ProgressBar";

const LIST_ICONS = ["🗂️", "🏠", "🚗", "🛒", "💼", "🎓", "🧰", "✈️", "🎁", "💊", "📚", "🐾"];

/** The cards you pick before seeing any tasks. Tap + to add one; tasks
 *  themselves live on the list you pick. */
export default function TodoListsScreen({ navigation }: any) {
  const t = useTheme();
  const [lists, setLists] = useState<TodoList[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(LIST_ICONS[0]);
  const [color, setColor] = useState(EVENT_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLists(await api.todo.lists());
      setError(null);
    } catch (err: any) {
      setError(err.message || "Couldn't load your lists.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function openModal() {
    setName("");
    setIcon(LIST_ICONS[0]);
    setColor(EVENT_COLORS[0]);
    setOpen(true);
  }

  async function create() {
    if (!name.trim()) return Alert.alert("Give the list a name.");
    setSaving(true);
    try {
      await api.todo.createList({ name: name.trim(), icon, color });
      setOpen(false);
      await load();
    } catch (err: any) {
      Alert.alert("Couldn't create that list", err.message);
    } finally {
      setSaving(false);
    }
  }

  const totalOpen = lists.reduce((n, l) => n + l.open_count, 0);

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: t.ink, fontFamily: fonts.display }]}>Lists</Text>
            <Text style={{ color: t.inkMuted, fontSize: 12.5, marginTop: 2 }}>
              {totalOpen === 0 ? "Nothing outstanding." : `${totalOpen} task${totalOpen === 1 ? "" : "s"} open`}
            </Text>
          </View>
          <Pressable onPress={openModal} style={[styles.addBtn, { backgroundColor: t.accent }]}>
            <Ionicons name="add" size={20} color={t.accentInk} />
          </Pressable>
        </View>

        {error && <Text style={{ color: t.inkMuted, fontSize: 13 }}>{error}</Text>}
        {!error && lists.length === 0 && (
          <Text style={{ color: t.inkMuted, fontSize: 13 }}>No lists yet — tap + to make one.</Text>
        )}

        {lists.map((l) => {
          const total = l.open_count + l.done_count;
          const pct = total ? (l.done_count / total) * 100 : 0;
          const tint = t.categoryColor(l.color);
          return (
            <Pressable
              key={l.id}
              onPress={() => navigation.navigate("TodoList", { listId: l.id, name: l.name })}
              style={[styles.card, { backgroundColor: t.page2, borderLeftColor: tint, borderLeftWidth: 3 }]}
            >
              <View style={styles.cardHead}>
                <Text style={styles.icon}>{l.icon}</Text>
                <Text style={{ flex: 1, color: t.ink, fontSize: 15, fontWeight: "600" }}>{l.name}</Text>
                <Text style={{ color: t.ink, fontSize: 15, fontFamily: fonts.mono }}>{l.open_count}</Text>
                <Ionicons name="chevron-forward" size={16} color={t.inkMuted} />
              </View>

              <View style={{ marginTop: 10 }}>
                <ProgressBar pct={pct} color={tint} />
              </View>

              <View style={styles.meta}>
                <Text style={{ color: t.inkMuted, fontSize: 11 }}>
                  {total ? `${l.done_count} of ${total} done` : "Nothing yet"}
                </Text>
                {l.overdue_count > 0 && (
                  <Text style={{ color: t.status.critical, fontSize: 11, marginLeft: "auto" }}>
                    {l.overdue_count} overdue
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          // Android's default resize behavior stopped reliably keeping this
          // bottom sheet's input above the keyboard once edge-to-edge display
          // became the default (Expo SDK 53+) -- "height" is the fix.
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.backdrop}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: t.page }]}>
            <Text style={[styles.sheetTitle, { color: t.ink, fontFamily: fonts.display }]}>New list</Text>

            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Groceries"
              placeholderTextColor={t.inkMuted}
              autoFocus
              style={[styles.field, { borderColor: t.rule, color: t.ink, backgroundColor: t.paper }]}
            />

            <Text style={[styles.label, { color: t.inkMuted }]}>Icon</Text>
            <View style={styles.iconRow}>
              {LIST_ICONS.map((ic) => {
                const on = ic === icon;
                return (
                  <Pressable
                    key={ic}
                    onPress={() => setIcon(ic)}
                    style={[styles.iconChip, { borderColor: on ? t.accent : t.rule, backgroundColor: on ? t.page2 : "transparent" }]}
                  >
                    <Text style={{ fontSize: 17 }}>{ic}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { color: t.inkMuted }]}>Colour</Text>
            <View style={styles.colorRow}>
              {EVENT_COLORS.map((hex) => {
                const on = hex === color;
                return (
                  <Pressable
                    key={hex}
                    onPress={() => setColor(hex)}
                    style={[styles.swatch, { backgroundColor: t.categoryColor(hex), borderColor: on ? t.ink : "transparent" }]}
                  />
                );
              })}
            </View>

            <View style={styles.buttonRow}>
              <Pressable
                onPress={create}
                disabled={saving}
                style={[styles.button, { backgroundColor: t.accent, opacity: saving ? 0.6 : 1 }]}
              >
                <Text style={{ color: t.accentInk, fontWeight: "600", fontSize: 14 }}>{saving ? "Creating…" : "Create list"}</Text>
              </Pressable>
              <Pressable onPress={() => setOpen(false)} style={styles.cancelButton}>
                <Text style={{ color: t.inkMuted, fontSize: 14 }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "flex-start", marginBottom: 18, gap: 12 },
  title: { fontSize: 26 },
  addBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  card: { borderRadius: 14, padding: 15, marginBottom: 11 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { fontSize: 20 },
  meta: { flexDirection: "row", alignItems: "center", marginTop: 7 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  sheetTitle: { fontSize: 19, marginBottom: 14 },
  field: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14 },
  label: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 16, marginBottom: 8 },
  iconRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  iconChip: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  colorRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
  buttonRow: { flexDirection: "row", gap: 12, marginTop: 22, alignItems: "center" },
  button: { flex: 1, borderRadius: 10, padding: 13, alignItems: "center" },
  cancelButton: { padding: 13 },
});
