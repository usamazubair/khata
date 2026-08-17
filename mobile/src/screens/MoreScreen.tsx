import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "../theme";

const ITEMS: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; route: string }[] = [
  { key: "categories", label: "Categories", icon: "pricetag-outline", route: "Categories" },
  { key: "fixed", label: "Fixed bills", icon: "calendar-outline", route: "FixedBills" },
  { key: "archives", label: "Archives", icon: "archive-outline", route: "Archives" },
  { key: "settings", label: "Settings", icon: "settings-outline", route: "Settings" },
];

export default function MoreScreen({ navigation }: any) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.paper, padding: 18 }}>
      <Text style={[styles.title, { color: t.ink, fontFamily: fonts.display }]}>More</Text>
      <View style={[styles.card, { backgroundColor: t.page2 }]}>
        {ITEMS.map((item, i) => (
          <Pressable
            key={item.key}
            onPress={() => navigation.navigate(item.route)}
            style={[styles.row, { borderColor: t.rule, borderBottomWidth: i === ITEMS.length - 1 ? 0 : 1 }]}
          >
            <Ionicons name={item.icon} size={18} color={t.inkMuted} />
            <Text style={{ flex: 1, color: t.ink, fontSize: 14 }}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={t.inkMuted} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, marginBottom: 16 },
  card: { borderRadius: 12, paddingHorizontal: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
});
