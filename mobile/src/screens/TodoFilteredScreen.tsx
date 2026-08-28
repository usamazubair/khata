import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Alert, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme, fonts } from "../theme";
import { api } from "../api";
import { TodoItem } from "../types";
import { DueFilter, filterByDue } from "../lib/dueFilter";
import TodoItemRow from "../components/TodoItemRow";
import DueFilterBar from "../components/DueFilterBar";
import EditTaskModal from "../components/EditTaskModal";

/** Every task across every list, filtered to just what's done or just
 *  what's left -- reached from the two icons below the lists grid. Toggling
 *  or deleting works the same as on a single list; adding doesn't, since
 *  there's no one list here to add to. */
export default function TodoFilteredScreen({ route, navigation }: any) {
  const t = useTheme();
  const { status, title } = route.params as { status: "open" | "done"; title: string };

  const [items, setItems] = useState<TodoItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dueFilter, setDueFilter] = useState<DueFilter>("All");
  const [editingItem, setEditingItem] = useState<TodoItem | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api.todo.items({ done: status === "done" ? "true" : "false" }));
      setError(null);
    } catch (err: any) {
      setError(err.message || "Couldn't load these tasks.");
    }
  }, [status]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  async function toggle(item: TodoItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    try {
      await api.todo.updateItem(item.id, { done: !item.done });
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

  // Only Remaining has a meaningful "when" to filter by -- a completed task's
  // due date isn't really relevant to it any more.
  const visible = status === "open" ? filterByDue(items, dueFilter) : items;

  return (
    <ScrollView
      style={{ backgroundColor: t.paper }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
    >
      <Text style={{ color: t.inkMuted, fontSize: 12.5, marginBottom: 14, fontFamily: fonts.mono }}>
        {visible.length} task{visible.length === 1 ? "" : "s"}
      </Text>

      {status === "open" && <DueFilterBar value={dueFilter} onChange={setDueFilter} />}

      {error && <Text style={{ color: t.inkMuted, fontSize: 13 }}>{error}</Text>}
      {!error && visible.length === 0 && (
        <Text style={{ color: t.inkMuted, fontSize: 13 }}>
          {status === "done"
            ? "Nothing done yet."
            : items.length
            ? `Nothing due ${dueFilter.toLowerCase()} — ${items.length} task${items.length === 1 ? "" : "s"} on "All".`
            : "Nothing outstanding — you're all caught up. 🎉"}
        </Text>
      )}

      {visible.length > 0 && (
        <View style={[styles.card, { backgroundColor: t.page2 }]}>
          {visible.map((item, i) => (
            <TodoItemRow
              key={item.id}
              item={item}
              last={i === visible.length - 1}
              showList
              onToggle={() => toggle(item)}
              onEdit={() => setEditingItem(item)}
              onDelete={() => remove(item)}
            />
          ))}
        </View>
      )}

      <Text style={{ color: t.inkMuted, fontSize: 11, textAlign: "center", marginTop: 18 }}>
        Long-press a task to edit or delete it · tap a list from Lists to add a new one
      </Text>

      <EditTaskModal item={editingItem} onClose={() => setEditingItem(null)} onSaved={load} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 40 },
  card: { borderRadius: 12, paddingHorizontal: 14 },
});
