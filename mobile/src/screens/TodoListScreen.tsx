import { useCallback, useEffect, useState } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "../theme";
import { api, parseDate } from "../api";
import { TodoItem } from "../types";
import { useKeyboardOffset } from "../lib/useKeyboardOffset";

/** How a due date reads relative to today. Compared as calendar days so
 *  "Today" doesn't flip at 00:00 UTC. */
function dueLabel(iso: string) {
  const due = parseDate(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { text: days === -1 ? "Yesterday" : `${Math.abs(days)} days late`, late: true };
  if (days === 0) return { text: "Today", soon: true };
  if (days === 1) return { text: "Tomorrow", soon: true };
  if (days <= 6) return { text: due.toLocaleDateString(undefined, { weekday: "long" }) };
  return { text: due.toLocaleDateString(undefined, { month: "short", day: "numeric" }) };
}

export default function TodoListScreen({ route, navigation }: any) {
  const t = useTheme();
  const { listId, name } = route.params;

  const [items, setItems] = useState<TodoItem[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const keyboardOffset = useKeyboardOffset();
  const insets = useSafeAreaInsets();
  // With the keyboard open, its own height already clears the system nav
  // bar; closed, the composer needs the nav bar's inset instead so it isn't
  // the one thing on this (tab-bar-less) screen sitting flush behind it.
  const bottomPad = keyboardOffset > 0 ? keyboardOffset : insets.bottom;

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
    setBusy(true);
    // Clear straight away — waiting on the round trip makes rattling off
    // several tasks feel sticky.
    setTitle("");
    try {
      await api.todo.addItem({ list_id: listId, title: text });
      await load();
    } catch (err: any) {
      setTitle(text);
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

  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  const row = (item: TodoItem, last: boolean) => {
    const due = item.due_date ? dueLabel(item.due_date) : null;
    const dueColor = due?.late ? t.status.critical : due?.soon ? t.status.warning : t.inkMuted;
    return (
      <Pressable key={item.id} onLongPress={() => remove(item)} style={[styles.item, { borderColor: t.rule, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
        <Pressable onPress={() => toggle(item)} hitSlop={10} style={styles.checkbox}>
          <View
            style={[
              styles.box,
              { borderColor: item.done ? t.status.good : t.rule, backgroundColor: item.done ? t.status.good : "transparent" },
            ]}
          >
            {item.done && <Ionicons name="checkmark" size={13} color="#fff" />}
          </View>
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: item.done ? t.inkMuted : t.ink,
              fontSize: 14,
              textDecorationLine: item.done ? "line-through" : "none",
            }}
          >
            {item.title}
          </Text>
          <View style={styles.itemMeta}>
            {due && !item.done && <Text style={{ color: dueColor, fontSize: 11 }}>{due.text}</Text>}
            {item.priority > 0 && !item.done && (
              <Ionicons
                name="flag"
                size={10}
                color={item.priority === 2 ? t.status.critical : t.status.warning}
              />
            )}
            {!!item.notes && (
              <Text style={{ color: t.inkMuted, fontSize: 11 }} numberOfLines={1}>
                {item.notes}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

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

        <View style={[styles.card, { backgroundColor: t.page2 }]}>
          {open.length === 0 ? (
            <Text style={{ color: t.inkMuted, fontSize: 13, paddingVertical: 8 }}>
              {items.length ? "All clear. 🎉" : "Nothing here yet — add your first task below."}
            </Text>
          ) : (
            open.map((item, i) => row(item, i === open.length - 1))
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
                {done.map((item, i) => row(item, i === done.length - 1))}
              </View>
            )}
          </>
        )}

        <Text style={{ color: t.inkMuted, fontSize: 11, textAlign: "center", marginTop: 18 }}>
          Long-press a task to delete it · dates and priorities are set on the web
        </Text>
      </ScrollView>

      <View style={[styles.composer, { backgroundColor: t.page2, borderTopColor: t.rule }]}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Add a task…"
          placeholderTextColor={t.inkMuted}
          returnKeyType="done"
          onSubmitEditing={add}
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
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 30 },
  card: { borderRadius: 12, paddingHorizontal: 14 },
  item: { flexDirection: "row", alignItems: "flex-start", gap: 11, paddingVertical: 11 },
  checkbox: { paddingTop: 1 },
  box: { width: 19, height: 19, borderRadius: 5, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  itemMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  doneToggle: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16, marginBottom: 8 },
  composer: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderTopWidth: 1 },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  addButton: { width: 42, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
