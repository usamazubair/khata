import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "../theme";

type Option = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
};

function OptionCard({ icon, title, description, onPress, tint, t }: Option & { tint: string; t: ReturnType<typeof useTheme> }) {
  return (
    <Pressable onPress={onPress} style={[styles.card, { backgroundColor: t.page2, borderLeftColor: tint }]}>
      <View style={[styles.iconWrap, { backgroundColor: tint + "22" }]}>
        <Ionicons name={icon} size={19} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.ink, fontSize: 14.5, fontWeight: "600" }}>{title}</Text>
        <Text style={{ color: t.inkMuted, fontSize: 11.5, marginTop: 2, lineHeight: 15 }}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={t.inkMuted} />
    </Pressable>
  );
}

/** What are you logging? Each answer goes straight to its own focused
 *  screen rather than piling every path into one form — fixed bills don't
 *  need an amount typed in, SMS doesn't need a category picker up front,
 *  and a manual expense doesn't need to see saved/budget categories. */
export default function AddScreen({ navigation }: any) {
  const t = useTheme();

  return (
    <ScrollView style={{ backgroundColor: t.paper }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: t.ink, fontFamily: fonts.display }]}>Add</Text>
      <Text style={{ color: t.inkMuted, fontSize: 12.5, marginBottom: 20 }}>What are you logging?</Text>

      <OptionCard
        t={t}
        tint={t.accent}
        icon="receipt-outline"
        title="Fixed bill"
        description="Pick from what's due this month — amount and category are already set."
        onPress={() => navigation.navigate("FixedDue")}
      />
      <OptionCard
        t={t}
        tint={t.accent2}
        icon="create-outline"
        title="Expense — manual"
        description="Type in the amount and pick a category yourself."
        onPress={() => navigation.navigate("ManualEntry", { categoryType: "expense" })}
      />
      <OptionCard
        t={t}
        tint={t.accent2}
        icon="clipboard-outline"
        title="Expense — paste SMS"
        description="Paste a bank alert and Khata reads the amount and merchant for you."
        onPress={() => navigation.navigate("SmsReview")}
      />
      <OptionCard
        t={t}
        tint={t.accent2}
        icon="cash-outline"
        title="Expense — cash"
        description="Type in the amount — the Cash category is already picked for you."
        onPress={() => navigation.navigate("ManualEntry", { categoryType: "expense", lockCategoryName: "Cash" })}
      />
      <OptionCard
        t={t}
        tint={t.accent3}
        icon="wallet-outline"
        title="Saved"
        description="Money moved into a savings goal."
        onPress={() => navigation.navigate("ManualEntry", { categoryType: "saved" })}
      />
      <OptionCard
        t={t}
        tint={t.accent3}
        icon="pie-chart-outline"
        title="Budget"
        description="Spending against one of your budgets."
        onPress={() => navigation.navigate("ManualEntry", { categoryType: "budget" })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 40 },
  title: { fontSize: 26 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderLeftWidth: 3, padding: 14, marginBottom: 10 },
  iconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
