import { useCallback, useEffect, useState } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, RefreshControl, Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { api } from "../api";
import { TodoItem } from "../types";
import { useKeyboardClearance } from "../lib/useKeyboardOffset";
import { isoDate } from "../lib/schedule";
import { DueFilter, filterByDue } from "../lib/dueFilter";
import TodoItemRow from "../components/TodoItemRow";
import DueFilterBar from "../components/DueFilterBar";

const PRIORITIES = [
  { value: 0, label: "None", icon: "flag-outline" as const },
  { value: 1, label: "Medium", icon: "flag" as const },
  { value: 2, label: "High", icon: "flag" as const },
];

export default function TodoListScreen({ route, navigation }: any) {
  const t = useTheme();
  const { listId, name } = route.params;

  const [items, setItems] = useState<TodoItem[]>([]);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [priority, setPriority] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dueFilter, setDueFilter] = useState<DueFilter>("All");
  const [showDone, setShowDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();
  const bottomPad = useKeyboardClearance(insets);

  const load = useCallback(async () => {
    try {
      setItems(await api.todo.items({ list_id: String(listId) }));
      setError(null);
    } catch (err: any) {
      setError(err.message || "Couldn't load these tasks.");
    }
  }, [listId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    navigation.setOptions({ title: name ?? "Tasks" });
  }, [navigation, name]);

  async function add() {
    const text = title.trim();
    if (!text) return;
    const dueAtAdd = dueDate;
    const priorityAtAdd = priority;
    setBusy(true);
    // Clear straight away — waiting on the round trip makes rattling off
    // several tasks feel sticky.
    setTitle("");
    setDueDate(null);
    setPriority(0);
    try {
      await api.todo.addItem({ list_id: listId, title: text, due_date: dueAtAdd, priority: priorityAtAdd });
      await load();
    } catch (err: any) {
      setTitle(text);
      setDueDate(dueAtAdd);
      setPriority(priorityAtAdd);
      Alert.alert("Couldn't add that", err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(item: TodoItem) {
    // Flip locally first so the checkbox answers instantly, then reconcile.
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)));
    try {
      await api.todo.updateItem(item.id, { done: !item.done });
      await load();
    } catch (err: any) {
      Alert.alert("Couldn't save that", err.message);
      await load();
    }
  }

  function remove(item: TodoItem) {
    Alert.alert("Delete this task?", item.title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.todo.removeItem(item.id);
            await load();
          } catch (err: any) {
            Alert.alert("Couldn't delete", err.message);
          }
        },
      },
    ]);
  }

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  // "Done" always shows every finished task on this list, unfiltered --
  // this filter is only about narrowing down what's still open.
  const allOpen = items.filter((i) => !i.done);
  const open = filterByDue(allOpen, dueFilter);
  const done = items.filter((i) => i.done);

  return (
    // Tracking the keyboard's own height and padding by that amount, rather
    // than leaning on KeyboardAvoidingView, since Android's native
    // resize/pan/height behaviors have proven unreliable across OEM skins
    // (Samsung's One UI in particular) since edge-to-edge display became the
    // Android default -- this works the same regardless of device or OS quirk.
    <View style={{ flex: 1, backgroundColor: t.paper, paddingBottom: bottomPad }}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
      >
        {error && <Text style={{ color: t.inkMuted, fontSize: 13, marginBottom: 12 }}>{error}</Text>}

        <DueFilterBar value={dueFilter} onChange={setDueFilter} />

        <View style={[styles.card, { backgroundColor: t.page2 }]}>
          {open.length === 0 ? (
            <Text style={{ color: t.inkMuted, fontSize: 13, paddingVertical: 8 }}>
              {!items.length
                ? "Nothing here yet — add your first task below."
                : !allOpen.length
                ? "All clear. 🎉"
                : `Nothing due ${dueFilter.toLowerCase()} — ${allOpen.length} task${allOpen.length === 1 ? "" : "s"} on "All".`}
            </Text>
          ) : (
            open.map((item, i) => (
              <TodoItemRow
                key={item.id}
                item={item}
                last={i === open.length - 1}
                onToggle={() => toggle(item)}
                onDelete={() => remove(item)}
              />
            ))
          )}
        </View>

        {done.length > 0 && (
          <>
            <Pressable onPress={() => setShowDone((v) => !v)} style={styles.doneToggle}>
              <Ionicons name={showDone ? "chevron-down" : "chevron-forward"} size={14} color={t.inkMuted} />
              <Text style={{ color: t.inkMuted, fontSize: 12.5 }}>Done ({done.length})</Text>
            </Pressable>
            {showDone && (
              <View style={[styles.card, { backgroundColor: t.page2 }]}>
                {done.map((item, i) => (
                  <TodoItemRow
                    key={item.id}
                    item={item}
                    last={i === done.length - 1}
                    onToggle={() => toggle(item)}
                    onDelete={() => remove(item)}
                  />
                ))}
              </View>
            )}
          </>
        )}

        <Text style={{ color: t.inkMuted, fontSize: 11, textAlign: "center", marginTop: 18 }}>
          Long-press a task to delete it
        </Text>
      </ScrollView>

      <View style={[styles.composer, { backgroundColor: t.page2, borderTopColor: t.rule }]}>
        <View style={styles.optionsRow}>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            style={[styles.optionChip, { borderColor: dueDate ? t.accent : t.rule, backgroundColor: dueDate ? t.accent + "1a" : "transparent" }]}
          >
            <Ionicons name="calendar-outline" size={13} color={dueDate ? t.accent : t.inkMuted} />
            <Text style={{ color: dueDate ? t.accent : t.inkMuted, fontSize: 11.5 }}>
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
              styles.optionChip,
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
            <Text style={{ color: priority > 0 ? (priority === 2 ? t.status.critical : t.status.warning) : t.inkMuted, fontSize: 11.5 }}>
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

        <View style={styles.composerRow}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Add a task…"
            placeholderTextColor={t.inkMuted}
            multiline
            style={[styles.input, { borderColor: t.rule, color: t.ink, backgroundColor: t.page }]}
          />
          <Pressable
            onPress={add}
            disabled={busy || !title.trim()}
            style={[styles.addButton, { backgroundColor: t.accent, opacity: busy || !title.trim() ? 0.5 : 1 }]}
          >
            <Ionicons name="add" size={22} color={t.accentInk} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 30 },
  card: { borderRadius: 12, paddingHorizontal: 14 },
  doneToggle: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16, marginBottom: 8 },
  composer: { padding: 12, borderTopWidth: 1 },
  optionsRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, maxHeight: 110 },
  addButton: { width: 42, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
