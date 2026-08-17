import { View, StyleSheet } from "react-native";

export default function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <View style={[styles.dot, { backgroundColor: color, width: size, height: size, borderRadius: size / 2 }]} />;
}

const styles = StyleSheet.create({
  dot: { flexShrink: 0 },
});
