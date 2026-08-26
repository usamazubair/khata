import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Image } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, fonts } from "../theme";
import { api, parseDate } from "../api";
import { WorkoutSession, WorkoutSessionExercise } from "../types";
import { refreshReminders } from "../lib/reminders";

/** One exercise on the checklist: tick it complete, optionally jot a note.
 *  That's the entire interaction — no reps, no weight to type in. */
function ExerciseRow({
  se,
  onToggle,
  onNotes,
  busy,
  last,
}: {
  se: WorkoutSessionExercise;
  onToggle: () => void;
  onNotes: (v: string) => void;
  busy: boolean;
  last: boolean;
}) {
  const t = useTheme();
  const [notes, setNotes] = useState(se.notes);

  return (
    <View style={[styles.row, { borderColor: t.rule, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
      <Pressable onPress={onToggle} disabled={busy} hitSlop={8} style={{ paddingTop: 1 }}>
        <View
          style={[
            styles.checkbox,
            { borderColor: se.completed ? t.status.good : t.rule, backgroundColor: se.completed ? t.status.good : "transparent" },
          ]}
        >
          {se.completed && <Ionicons name="checkmark" size={15} color="#fff" />}
        </View>
      </Pressable>

      {se.media_url && se.media_type === "image" ? (
        <Image source={{ uri: se.media_url }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty, { borderColor: t.rule }]}>
          <Ionicons name="barbell-outline" size={14} color={t.inkMuted} />
        </View>
      )}

      <View style={{ flex: 1 }}>
        <Text
          style={{ color: se.completed ? t.inkMuted : t.ink, fontSize: 14, fontWeight: "600", textDecorationLine: se.completed ? "line-through" : "none" }}
          numberOfLines={1}
        >
          {se.exercise_name}
        </Text>
        <Text style={{ color: t.inkMuted, fontSize: 10.5, marginTop: 1 }}>{se.category_name}</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          onBlur={() => notes !== se.notes && onNotes(notes)}
          placeholder="Add a note…"
          placeholderTextColor={t.inkMuted}
          style={[styles.notesInput, { color: t.ink, borderColor: t.rule }]}
        />
      </View>
    </View>
  );
}

export default function WorkoutSessionScreen({ route, navigation }: any) {
  const t = useTheme();
  const { sessionId } = route.params;

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const detail = await api.workouts.session(sessionId);
      setSession(detail);
      setError(null);
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

  async function toggle(se: WorkoutSessionExercise) {
    setBusyId(se.id);
    // Flip locally first so the checkbox answers instantly.
    setSession((prev) =>
      prev
        ? {
            ...prev,
            completed_exercises: prev.completed_exercises + (se.completed ? -1 : 1),
            exercises: prev.exercises?.map((x) => (x.id === se.id ? { ...x, completed: !se.completed } : x)),
          }
        : prev
    );
    try {
      await api.workouts.updateSessionExercise(se.id, { completed: !se.completed });
      // A completed workout is exactly the kind of thing worth re-syncing
      // reminders over, same as logging a transaction elsewhere in the app.
      refreshReminders();
    } catch (err: any) {
      alert(err.message || "Couldn't save that.");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function saveNotes(se: WorkoutSessionExercise, notes: string) {
    try {
      await api.workouts.updateSessionExercise(se.id, { notes });
    } catch (err: any) {
      alert(err.message || "Couldn't save that note.");
    }
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: t.paper, padding: 18 }}>
        <Text style={{ color: t.inkMuted, fontSize: 13 }}>{error}</Text>
      </View>
    );
  }
  if (!session) return <View style={{ flex: 1, backgroundColor: t.paper }} />;

  return (
    <ScrollView style={{ backgroundColor: t.paper }} contentContainerStyle={styles.container}>
      <Text style={{ color: t.inkMuted, fontSize: 12.5, marginBottom: 4 }}>
        {parseDate(session.occurred_on).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
      </Text>
      <Text style={[styles.title, { color: t.ink, fontFamily: fonts.display }]}>{session.name || "Workout"}</Text>

      <View style={[styles.progressCard, { backgroundColor: t.page2 }]}>
        <Text style={[styles.label, { color: t.inkMuted }]}>Completed</Text>
        <Text style={{ color: t.ink, fontSize: 20, fontFamily: fonts.mono, fontWeight: "600", marginTop: 2 }}>
          {session.completed_exercises} / {session.total_exercises}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: t.page2 }]}>
        {!session.exercises?.length && (
          <Text style={{ color: t.inkMuted, fontSize: 13 }}>
            No exercises on this session — those are added on the web dashboard.
          </Text>
        )}
        {session.exercises?.map((se, i) => (
          <ExerciseRow
            key={se.id}
            se={se}
            busy={busyId === se.id}
            last={i === (session.exercises?.length ?? 0) - 1}
            onToggle={() => toggle(se)}
            onNotes={(v) => saveNotes(se, v)}
          />
        ))}
      </View>

      {!!session.notes && (
        <>
          <Text style={[styles.sectionLabel, { color: t.inkMuted }]}>Session notes</Text>
          <View style={[styles.card, { backgroundColor: t.page2 }]}>
            <Text style={{ color: t.ink, fontSize: 13, lineHeight: 19 }}>{session.notes}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 50 },
  title: { fontSize: 22, marginBottom: 16 },
  label: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6 },
  progressCard: { borderRadius: 12, padding: 14, marginBottom: 16 },
  card: { borderRadius: 12, padding: 6 },
  sectionLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 22, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 11, padding: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  thumb: { width: 40, height: 40, borderRadius: 8 },
  thumbEmpty: { borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  notesInput: { marginTop: 5, fontSize: 12, borderBottomWidth: 1, paddingVertical: 3 },
});
