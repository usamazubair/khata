import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "../theme";
import { api } from "../api";
import { Exercise, WorkoutSession, WorkoutSet } from "../types";
import { kg } from "./WorkoutHomeScreen";

export default function WorkoutSessionScreen({ route, navigation }: any) {
  const t = useTheme();
  const { sessionId } = route.params;

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseId, setExerciseId] = useState<number | null>(null);
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [detail, list] = await Promise.all([api.workouts.session(sessionId), api.exercises.list()]);
      setSession(detail);
      setExercises(list);
      setName(detail.name || "");
      setError(null);

      // Straight sets are the common case, so carry the last set forward.
      const last: WorkoutSet | undefined = detail.sets?.[detail.sets.length - 1];
      if (last) {
        setExerciseId(last.exercise_id);
        setReps(String(last.reps));
        setWeight(String(Number(last.weight)));
      } else if (list.length) {
        setExerciseId((prev) => prev ?? list[0].id);
      }
    } catch (err: any) {
      setError(err.message || "Couldn't load this session.");
    }
  }, [sessionId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    navigation.setOptions({ title: session?.name || "Workout" });
  }, [navigation, session?.name]);

  async function addSet() {
    const numReps = Number(reps);
    if (!exerciseId) return Alert.alert("Pick an exercise first.");
    if (!numReps || numReps <= 0) return Alert.alert("Enter how many reps you did.");
    setSaving(true);
    try {
      await api.workouts.addSet(sessionId, { exercise_id: exerciseId, reps: numReps, weight: Number(weight) || 0 });
      await load();
    } catch (err: any) {
      Alert.alert("Couldn't log that set", err.message);
    } finally {
      setSaving(false);
    }
  }

  function removeSet(set: WorkoutSet) {
    Alert.alert("Delete this set?", `${set.exercise_name} — ${set.reps} × ${kg(set.weight)}`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.workouts.removeSet(set.id);
            await load();
          } catch (err: any) {
            Alert.alert("Couldn't delete", err.message);
          }
        },
      },
    ]);
  }

  async function saveName() {
    if (!session || name === session.name) return;
    try {
      await api.workouts.updateSession(sessionId, { name });
      await load();
    } catch (err: any) {
      Alert.alert("Couldn't rename", err.message);
    }
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: t.paper, padding: 18 }}>
        <Text style={{ color: t.inkMuted, fontSize: 13 }}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: t.paper }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <TextInput
        value={name}
        onChangeText={setName}
        onBlur={saveName}
        placeholder="Name this workout"
        placeholderTextColor={t.inkMuted}
        style={[styles.nameInput, { color: t.ink, borderColor: t.rule, fontFamily: fonts.display }]}
      />

      {session && (
        <View style={styles.statRow}>
          {[
            { label: "Sets", value: String(session.set_count) },
            { label: "Reps", value: String(session.total_reps) },
            { label: "Volume", value: kg(session.volume) },
          ].map((s) => (
            <View key={s.label} style={[styles.statTile, { backgroundColor: t.page2 }]}>
              <Text style={[styles.label, { color: t.inkMuted }]}>{s.label}</Text>
              <Text style={[styles.statValue, { color: t.ink, fontFamily: fonts.mono }]}>{s.value}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={[styles.sectionLabel, { color: t.inkMuted }]}>Log a set</Text>
      <View style={[styles.card, { backgroundColor: t.page2 }]}>
        {exercises.length === 0 ? (
          <Text style={{ color: t.inkMuted, fontSize: 12.5 }}>
            No active exercises yet — add some from the dashboard.
          </Text>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {exercises.map((e) => {
                const selected = e.id === exerciseId;
                return (
                  <Pressable
                    key={e.id}
                    onPress={() => setExerciseId(e.id)}
                    style={[
                      styles.chip,
                      { borderColor: selected ? t.accent : t.rule, backgroundColor: selected ? t.page : "transparent" },
                    ]}
                  >
                    <Text style={{ color: t.ink, fontSize: 12, fontWeight: selected ? "600" : "400" }}>{e.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.inline}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: t.inkMuted, marginBottom: 5 }]}>Reps</Text>
                <TextInput
                  value={reps}
                  onChangeText={(v) => setReps(v.replace(/[^0-9]/g, ""))}
                  keyboardType="number-pad"
                  placeholder="8"
                  placeholderTextColor={t.inkMuted}
                  style={[styles.input, { borderColor: t.rule, color: t.ink, backgroundColor: t.page }]}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: t.inkMuted, marginBottom: 5 }]}>Weight (kg)</Text>
                <TextInput
                  value={weight}
                  onChangeText={(v) => setWeight(v.replace(/[^0-9.]/g, ""))}
                  keyboardType="decimal-pad"
                  placeholder="60"
                  placeholderTextColor={t.inkMuted}
                  style={[styles.input, { borderColor: t.rule, color: t.ink, backgroundColor: t.page }]}
                />
              </View>
            </View>

            <Pressable
              onPress={addSet}
              disabled={saving}
              style={[styles.button, { backgroundColor: t.accent, opacity: saving ? 0.6 : 1 }]}
            >
              <Text style={{ color: t.accentInk, fontWeight: "600", fontSize: 15 }}>
                {saving ? "Logging…" : "Add set"}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      <Text style={[styles.sectionLabel, { color: t.inkMuted }]}>Sets</Text>
      <View style={[styles.card, { backgroundColor: t.page2 }]}>
        {!session?.sets?.length && <Text style={{ color: t.inkMuted, fontSize: 13 }}>Nothing logged yet.</Text>}
        {session?.sets?.map((s, i) => (
          <Pressable
            key={s.id}
            onLongPress={() => removeSet(s)}
            style={[styles.setRow, { borderColor: t.rule, borderBottomWidth: i === session.sets!.length - 1 ? 0 : 1 }]}
          >
            <Text style={[styles.setIndex, { color: t.inkMuted, fontFamily: fonts.mono }]}>{i + 1}</Text>
            <Text style={{ flex: 1, color: t.ink, fontSize: 13 }} numberOfLines={1}>{s.exercise_name}</Text>
            <Text style={{ color: t.ink, fontFamily: fonts.mono, fontSize: 13 }}>
              {s.reps} × {kg(s.weight)}
            </Text>
          </Pressable>
        ))}
        {!!session?.sets?.length && (
          <Text style={{ color: t.inkMuted, fontSize: 11, textAlign: "center", marginTop: 10 }}>
            Long-press a set to delete it
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 50 },
  nameInput: { fontSize: 22, borderBottomWidth: 1, paddingBottom: 8, marginBottom: 16 },
  statRow: { flexDirection: "row", gap: 10 },
  statTile: { flex: 1, borderRadius: 12, padding: 12 },
  label: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6 },
  statValue: { fontSize: 17, fontWeight: "600", marginTop: 4 },
  sectionLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 22, marginBottom: 8 },
  card: { borderRadius: 12, padding: 14 },
  chip: { borderWidth: 1, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 12, marginRight: 8 },
  inline: { flexDirection: "row", gap: 10 },
  input: { borderWidth: 1, borderRadius: 10, padding: 11, fontSize: 14 },
  button: { marginTop: 14, borderRadius: 10, padding: 13, alignItems: "center" },
  setRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
  setIndex: { width: 20, fontSize: 11 },
});
