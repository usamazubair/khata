import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Modal, Platform, StyleSheet, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "../theme";
import { api } from "../api";
import { isoDate } from "../lib/schedule";
import { useKeyboardClearance } from "../lib/useKeyboardOffset";
import { TodoItem } from "../types";

const PRIORITIES = [
  { value: 0, label: "None", icon: "flag-outline" as const },
  { value: 1, label: "Medium", icon: "flag" as const },
  { value: 2, label: "High", icon: "flag" as const },
];

/** The task-editing counterpart to TodoListScreen's add composer -- same
 *  fields (title, due date, priority), reached from long-pressing a task
 *  instead of typing a new one. Shared by both the per-list screen and the
 *  cross-list Remaining/Completed views, since both list tasks via the
 *  same TodoItemRow. */
export default function EditTaskModal({
  item,
  onClose,
  onSaved,
}: {
  item: TodoItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useKeyboardClearance(insets);

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [priority, setPriority] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setDueDate(item.due_date);
      setPriority(item.priority);
      setShowDatePicker(false);
    }
  }, [item]);

  async function save() {
    if (!item) return;
    const text = title.trim();
    if (!text) return Alert.alert("Give it a title.");
    setSaving(true);
    try {
      await api.todo.updateItem(item.id, { title: text, due_date: dueDate, priority });
      onSaved();
      onClose();
    } catch (err: any) {
      Alert.alert("Couldn't save that", err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={!!item} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingBottom: bottomPad }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: t.page }]}>
          <Text style={[styles.title, { color: t.ink, fontFamily: fonts.display }]}>Edit task</Text>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Task title"
            placeholderTextColor={t.inkMuted}
            multiline
            style={[styles.field, { borderColor: t.rule, color: t.ink, backgroundColor: t.paper }]}
          />

          <View style={styles.optionsRow}>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={[styles.chip, { borderColor: dueDate ? t.accent : t.rule, backgroundColor: dueDate ? t.accent + "1a" : "transparent" }]}
            >
              <Ionicons name="calendar-outline" size={13} color={dueDate ? t.accent : t.inkMuted} />
              <Text style={{ color: dueDate ? t.accent : t.inkMuted, fontSize: 12 }}>
                {dueDate ? new Date(`${dueDate}T00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Date"}
              </Text>
              {!!dueDate && (
                <Pressable onPress={() => setDueDate(null)} hitSlop={8}>
                  <Ionicons name="close-circle" size={13} color={t.accent} />
                </Pressable>
              )}
            </Pressable>

            <Pressable
              onPress={() => setPriority((p) => (p + 1) % 3)}
              style={[
                styles.chip,
                {
                  borderColor: priority > 0 ? (priority === 2 ? t.status.critical : t.status.warning) : t.rule,
                  backgroundColor: priority > 0 ? (priority === 2 ? t.status.critical : t.status.warning) + "1a" : "transparent",
                },
              ]}
            >
              <Ionicons
                name={PRIORITIES[priority].icon}
                size={13}
                color={priority > 0 ? (priority === 2 ? t.status.critical : t.status.warning) : t.inkMuted}
              />
              <Text style={{ color: priority > 0 ? (priority === 2 ? t.status.critical : t.status.warning) : t.inkMuted, fontSize: 12 }}>
                {PRIORITIES[priority].label}
              </Text>
            </Pressable>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={dueDate ? new Date(`${dueDate}T00:00`) : new Date()}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              onChange={(_, selected) => {
                setShowDatePicker(Platform.OS === "ios");
                if (selected) setDueDate(isoDate(selected));
              }}
            />
          )}

          <View style={styles.buttonRow}>
            <Pressable
              onPress={save}
              disabled={saving}
              style={[styles.button, { backgroundColor: t.accent, opacity: saving ? 0.6 : 1 }]}
            >
              <Text style={{ color: t.accentInk, fontWeight: "600", fontSize: 14 }}>{saving ? "Saving…" : "Save"}</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.cancelButton}>
              <Text style={{ color: t.inkMuted, fontSize: 14 }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  title: { fontSize: 19, marginBottom: 14 },
  field: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, maxHeight: 90 },
  optionsRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7 },
  buttonRow: { flexDirection: "row", gap: 12, marginTop: 20, alignItems: "center" },
  button: { flex: 1, borderRadius: 10, padding: 13, alignItems: "center" },
  cancelButton: { padding: 13 },
});
