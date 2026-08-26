import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { parseDate } from "../api";
import { TodoItem } from "../types";

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

/** One task: a checkbox, its title, and whatever metadata applies. Used both
 *  on a single list (where the list is implied) and on the cross-list
 *  completed/remaining views (`showList` adds a small badge so it's clear
 *  which list each task actually belongs to). */
export default function TodoItemRow({
  item,
  last,
  onToggle,
  onDelete,
  showList,
}: {
  item: TodoItem;
  last: boolean;
  onToggle: () => void;
  onDelete: () => void;
  showList?: boolean;
}) {
  const t = useTheme();
  const due = item.due_date ? dueLabel(item.due_date) : null;
  const dueColor = due?.late ? t.status.critical : due?.soon ? t.status.warning : t.inkMuted;

  return (
    <Pressable
      onLongPress={onDelete}
      style={[styles.item, { borderColor: t.rule, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}
    >
      <Pressable onPress={onToggle} hitSlop={10} style={styles.checkbox}>
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
          {showList && (
            <Text style={{ color: t.inkMuted, fontSize: 11 }}>
              {item.list_icon} {item.list_name}
            </Text>
          )}
          {due && !item.done && <Text style={{ color: dueColor, fontSize: 11 }}>{due.text}</Text>}
          {item.priority > 0 && !item.done && (
            <Ionicons name="flag" size={10} color={item.priority === 2 ? t.status.critical : t.status.warning} />
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
}

const styles = StyleSheet.create({
  item: { flexDirection: "row", alignItems: "flex-start", gap: 11, paddingVertical: 11 },
  checkbox: { paddingTop: 1 },
  box: { width: 19, height: 19, borderRadius: 5, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  itemMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
});
