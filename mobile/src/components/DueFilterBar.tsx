import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTheme } from "../theme";
import { DUE_FILTERS, DueFilter } from "../lib/dueFilter";

/** The Today / Tomorrow / All segmented control shared by every screen that
 *  lists open tasks by due date. */
export default function DueFilterBar({ value, onChange }: { value: DueFilter; onChange: (f: DueFilter) => void }) {
  const t = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: t.page2 }]}>
      {DUE_FILTERS.map((f) => (
        <Pressable key={f} onPress={() => onChange(f)} style={[styles.seg, value === f && { backgroundColor: t.page }]}>
          <Text style={{ color: t.ink, fontSize: 12.5, fontWeight: value === f ? "600" : "400" }}>{f}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", borderRadius: 10, padding: 3, gap: 3, marginBottom: 12 },
  seg: { flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: 7 },
});
