import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "../theme";
import { api } from "../api";
import { TodoList } from "../types";
import ProgressBar from "../components/ProgressBar";

/** The cards you pick before seeing any tasks. Lists themselves are shaped on
 *  the web dashboard; this is where you choose one. */
export default function TodoListsScreen({ navigation }: any) {
  const t = useTheme();
  const [lists, setLists] = useState<TodoList[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  const totalOpen = lists.reduce((n, l) => n + l.open_count, 0);

  return (
    <ScrollView
      style={{ backgroundColor: t.paper }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
    >
      <Text style={[styles.title, { color: t.ink, fontFamily: fonts.display }]}>Lists</Text>
      <Text style={{ color: t.inkMuted, fontSize: 12.5, marginBottom: 18 }}>
        {totalOpen === 0 ? "Nothing outstanding." : `${totalOpen} task${totalOpen === 1 ? "" : "s"} open`}
      </Text>

      {error && <Text style={{ color: t.inkMuted, fontSize: 13 }}>{error}</Text>}
      {!error && lists.length === 0 && (
        <Text style={{ color: t.inkMuted, fontSize: 13 }}>
          No lists yet — make one on the web dashboard.
        </Text>
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
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 40 },
  title: { fontSize: 26 },
  card: { borderRadius: 14, padding: 15, marginBottom: 11 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { fontSize: 20 },
  meta: { flexDirection: "row", alignItems: "center", marginTop: 7 },
});
