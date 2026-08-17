import { View, Text, StyleSheet } from "react-native";
import { useTheme, fonts } from "../theme";

// Generic modules exist but have no sections yet — those are defined on the
// dashboard and will render here from their stored schema.
export default function ModulePlaceholderScreen({ route }: any) {
  const t = useTheme();
  const { name, icon } = route.params ?? {};

  return (
    <View style={[styles.container, { backgroundColor: t.paper }]}>
      <Text style={styles.icon}>{icon || "📦"}</Text>
      <Text style={[styles.title, { color: t.ink, fontFamily: fonts.display }]}>{name}</Text>
      <Text style={[styles.body, { color: t.inkMuted }]}>
        This module doesn't have any sections yet. Add them from the dashboard and they'll show up here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  icon: { fontSize: 44, marginBottom: 14 },
  title: { fontSize: 22, marginBottom: 8 },
  body: { fontSize: 13, textAlign: "center", lineHeight: 19, maxWidth: 300 },
});
