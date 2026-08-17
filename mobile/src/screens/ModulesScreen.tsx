import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "../theme";
import { api, ApiNotConfiguredError } from "../api";
import { Module } from "../types";
import { useAuth } from "../AuthContext";

export default function ModulesScreen({ navigation }: any) {
  const t = useTheme();
  const { user, signOut } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setModules(await api.modules());
      setError(null);
    } catch (err: any) {
      if (err instanceof ApiNotConfiguredError) setError("Set the server address in Settings.");
      else setError(err.message || "Couldn't load your modules.");
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

  function open(m: Module) {
    // Khata has hand-built screens; generic modules render from their schema.
    if (m.kind === "system" && m.slug === "khata") navigation.navigate("Khata");
    else navigation.navigate("Sections", { moduleId: m.id, name: m.name, icon: m.icon });
  }

  return (
    <ScrollView
      style={{ backgroundColor: t.paper }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.wordmark, { color: t.ink, fontFamily: fonts.display }]}>Modules</Text>
          <Text style={{ color: t.inkMuted, fontSize: 12 }}>{user?.name || user?.email}</Text>
        </View>
        <Pressable onPress={signOut} style={[styles.signOut, { borderColor: t.rule }]} hitSlop={6}>
          <Text style={{ color: t.inkMuted, fontSize: 12 }}>Sign out</Text>
        </Pressable>
      </View>

      {error && <Text style={{ color: t.inkMuted, fontSize: 13, marginBottom: 12 }}>{error}</Text>}

      {!error && modules.length === 0 && (
        <Text style={{ color: t.inkMuted, fontSize: 13 }}>No modules have been shared with you yet.</Text>
      )}

      <View style={styles.grid}>
        {modules.map((m) => (
          <Pressable key={m.id} onPress={() => open(m)} style={[styles.card, { backgroundColor: t.page2, borderColor: t.rule }]}>
            <Text style={styles.icon}>{m.icon}</Text>
            <Text style={{ color: t.ink, fontSize: 15, fontWeight: "600", fontFamily: fonts.display }}>{m.name}</Text>
            {!!m.description && (
              <Text style={{ color: t.inkMuted, fontSize: 11.5, marginTop: 3 }} numberOfLines={2}>
                {m.description}
              </Text>
            )}
            <Ionicons name="chevron-forward" size={15} color={t.inkMuted} style={styles.chevron} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "flex-start", marginBottom: 20 },
  wordmark: { fontSize: 28 },
  signOut: { borderWidth: 1, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, marginTop: 6 },
  grid: { gap: 12 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, position: "relative" },
  icon: { fontSize: 26, marginBottom: 8 },
  chevron: { position: "absolute", right: 14, top: "50%" },
});
