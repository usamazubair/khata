import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "../theme";
import { api } from "../api";
import { Module } from "../types";
import { useAuth } from "../AuthContext";

// Same slug -> hue mapping as the web dashboard's Modules page, so the two
// feel like one app.
const MODULE_TINTS: Record<string, string> = {
  transactions: "#2f6bff",
  workout: "#f4661f",
  timetable: "#7b3ff2",
  todo: "#00b37e",
};
const FALLBACK_TINT = "#7b3ff2";

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
      setError(err.message || "Couldn't load your modules.");
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

  // Each module has its own hand-built stack, keyed off its slug.
  const ROUTES: Record<string, string> = {
    transactions: "Transactions",
    workout: "Workout",
    timetable: "Timetable",
    todo: "Todo",
  };

  function open(m: Module) {
    const route = ROUTES[m.slug];
    if (route) navigation.navigate(route);
  }

  // Same hue per module as the web dashboard's Modules page (same series
  // hex values), run through categoryColor so it steps to its dark-mode
  // equivalent too.
  const tint = (slug: string) => t.categoryColor(MODULE_TINTS[slug] ?? FALLBACK_TINT);

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
        <Pressable onPress={() => navigation.navigate("Notifications")} hitSlop={8} style={styles.bell}>
          <Ionicons name="notifications-outline" size={20} color={t.ink} />
        </Pressable>
        <Pressable onPress={signOut} style={[styles.signOut, { borderColor: t.rule }]} hitSlop={6}>
          <Text style={{ color: t.inkMuted, fontSize: 12 }}>Sign out</Text>
        </Pressable>
      </View>

      {error && <Text style={{ color: t.inkMuted, fontSize: 13, marginBottom: 12 }}>{error}</Text>}

      {!error && modules.length === 0 && (
        <Text style={{ color: t.inkMuted, fontSize: 13 }}>No modules have been shared with you yet.</Text>
      )}

      <View style={styles.grid}>
        {modules.map((m) => {
          const hue = tint(m.slug);
          return (
            <Pressable key={m.id} onPress={() => open(m)} style={[styles.card, { backgroundColor: t.page2, borderColor: t.rule }]}>
              <View style={[styles.strip, { backgroundColor: hue }]} />
              <View style={[styles.iconBubble, { backgroundColor: hue + "29" }]}>
                <Text style={styles.icon}>{m.icon}</Text>
              </View>
              <Text style={{ color: t.ink, fontSize: 15, fontWeight: "600", fontFamily: fonts.display }}>{m.name}</Text>
              {!!m.description && (
                <Text style={{ color: t.inkMuted, fontSize: 11.5, marginTop: 3 }} numberOfLines={2}>
                  {m.description}
                </Text>
              )}
              <Ionicons name="chevron-forward" size={15} color={hue} style={styles.chevron} />
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "flex-start", marginBottom: 20 },
  wordmark: { fontSize: 28 },
  bell: { marginTop: 6, marginRight: 14, padding: 2 },
  signOut: { borderWidth: 1, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, marginTop: 6 },
  grid: { gap: 12 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, paddingTop: 14, position: "relative", overflow: "hidden" },
  strip: { position: "absolute", top: 0, left: 0, right: 0, height: 3 },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  icon: { fontSize: 21 },
  chevron: { position: "absolute", right: 14, top: "50%" },
});
