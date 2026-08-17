import { View, StyleSheet } from "react-native";
import { useTheme } from "../theme";

export default function ProgressBar({ pct, color }: { pct: number; color?: string }) {
  const t = useTheme();
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={[styles.track, { backgroundColor: t.rule }]}>
      <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: color || t.accent2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 7, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
});
