import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme, fonts } from "../theme";
import { api } from "../api";
import ExerciseMedia from "../components/ExerciseMedia";
import type { Exercise } from "../types";

export default function WorkoutExerciseScreen({ route }: any) {
  const t = useTheme();
  const { exerciseId } = route.params;
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const all: Exercise[] = await api.exercises.list(false);
      setExercise(all.find((x) => x.id === exerciseId) ?? null);
      setError(null);
    } catch (err: any) {
      setError(err.message ?? "Couldn't load this exercise.");
    }
  }, [exerciseId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: t.paper, padding: 18 }}>
        <Text style={{ color: t.inkMuted, fontSize: 13 }}>{error}</Text>
      </View>
    );
  }
  if (!exercise) return <View style={{ flex: 1, backgroundColor: t.paper }} />;

  return (
    <ScrollView style={{ backgroundColor: t.paper }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: t.ink, fontFamily: fonts.display }]}>{exercise.name}</Text>
      <Text style={{ color: t.inkMuted, fontSize: 12.5, marginBottom: 18 }}>
        {[exercise.muscle_group, exercise.equipment].filter(Boolean).join(" · ") || "No details"}
      </Text>

      <ExerciseMedia exercise={exercise} onChange={load} />

      {!!exercise.notes && (
        <>
          <Text style={[styles.sectionLabel, { color: t.inkMuted }]}>Notes</Text>
          <View style={[styles.card, { backgroundColor: t.page2 }]}>
            <Text style={{ color: t.ink, fontSize: 13, lineHeight: 19 }}>{exercise.notes}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 50 },
  title: { fontSize: 24, marginBottom: 2 },
  sectionLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 22, marginBottom: 8 },
  card: { borderRadius: 12, padding: 14 },
});
