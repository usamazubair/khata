import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "../theme";
import { api } from "../api";
import { Section } from "../types";

export default function SectionsScreen({ route, navigation }: any) {
  const t = useTheme();
  const { moduleId, name, icon } = route.params;
  const [sections, setSections] = useState<Section[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setSections(await api.sections.list(moduleId));
      setError(null);
    } catch (err: any) {
      setError(err.message || "Couldn't load this module.");
    }
  }, [moduleId]);

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

  return (
    <ScrollView
      style={{ backgroundColor: t.paper }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
    >
      {error && <Text style={{ color: t.inkMuted, fontSize: 13 }}>{error}</Text>}

      {!error && sections.length === 0 && (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>{icon || "📦"}</Text>
          <Text style={[styles.emptyTitle, { color: t.ink, fontFamily: fonts.display }]}>{name}</Text>
          <Text style={[styles.emptyBody, { color: t.inkMuted }]}>
            This module has no sections yet. Add them from the dashboard and they'll show up here.
          </Text>
        </View>
      )}

      {sections.map((s) => (
        <Pressable
          key={s.id}
          onPress={() => navigation.navigate("Records", { section: s, moduleName: name })}
          style={[styles.row, { backgroundColor: t.page2, borderColor: t.rule }]}
        >
          <Text style={styles.icon}>{s.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.ink, fontSize: 14, fontWeight: "600" }}>{s.name}</Text>
            <Text style={{ color: t.inkMuted, fontSize: 11.5 }}>
              {s.fields.length} field{s.fields.length === 1 ? "" : "s"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={t.inkMuted} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 40, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 12, padding: 14 },
  icon: { fontSize: 22 },
  emptyWrap: { alignItems: "center", paddingTop: 60, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 44, marginBottom: 14 },
  emptyTitle: { fontSize: 22, marginBottom: 8 },
  emptyBody: { fontSize: 13, textAlign: "center", lineHeight: 19, maxWidth: 300 },
});
