import { useCallback, useState } from "react";
import { View, Text, TextInput, Image, Pressable, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "../theme";
import { api } from "../api";
import type { Exercise } from "../types";

export default function WorkoutExercisesScreen({ navigation }: any) {
  const t = useTheme();
  const [rows, setRows] = useState<Exercise[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await api.exercises.list(false));
      setError(null);
    } catch (err: any) {
      setError(err.message ?? "Couldn't load exercises.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = rows.filter((x) =>
    `${x.name} ${x.muscle_group} ${x.equipment}`.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <View style={styles.header}>
        <View style={[styles.searchRow, { borderColor: t.rule, backgroundColor: t.page }]}>
          <Ionicons name="search" size={15} color={t.inkMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search exercises"
            placeholderTextColor={t.inkMuted}
            style={[styles.searchInput, { color: t.ink }]}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={t.accent}
          />
        }
      >
        {error && <Text style={{ color: t.inkMuted, fontSize: 13 }}>{error}</Text>}
        {!error && filtered.length === 0 && (
          <Text style={{ color: t.inkMuted, fontSize: 13 }}>
            {rows.length ? "Nothing matches your search." : "No exercises yet."}
          </Text>
        )}

        {filtered.map((x) => (
          <Pressable
            key={x.id}
            onPress={() => navigation.navigate("WorkoutExercise", { exerciseId: x.id, name: x.name })}
            style={[styles.card, { backgroundColor: t.page2, opacity: x.active ? 1 : 0.55 }]}
          >
            {x.media_url && x.media_type === "image" ? (
              <Image source={{ uri: x.media_url }} style={styles.thumb} resizeMode="cover" />
            ) : (
              <View style={[styles.thumb, styles.thumbEmpty, { borderColor: t.rule }]}>
                <Ionicons
                  name={x.media_type === "video" ? "videocam-outline" : "barbell-outline"}
                  size={18}
                  color={t.inkMuted}
                />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.ink, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
                {x.name}
              </Text>
              <Text style={{ color: t.inkMuted, fontSize: 11.5, marginTop: 2 }} numberOfLines={1}>
                {[x.muscle_group, x.equipment].filter(Boolean).join(" · ") || "No details"}
                {!x.active && " · inactive"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={t.inkMuted} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 13, padding: 0 },
  list: { padding: 18, paddingTop: 8, gap: 10 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, padding: 12 },
  thumb: { width: 52, height: 52, borderRadius: 8 },
  thumbEmpty: { borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
});
