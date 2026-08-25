import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme, fonts } from "../theme";
import { api } from "../api";
import { EVENT_COLORS, REMINDER_OPTIONS, WEEKDAYS, atLocal, isoDate, toMinutes } from "../lib/schedule";
import { refreshReminders } from "../lib/reminders";
import { TimetableOccurrence } from "../types";

type Params = {
  mode: "add" | "edit";
  /** add: the day the "+" button was pressed on. */
  dayIso?: string;
  dow?: number;
  /** edit: the occurrence tapped, already carrying every raw field. */
  event?: TimetableOccurrence;
};

const timeString = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** Add, edit or delete one timetable entry — the mobile counterpart to the
 *  web dashboard's composer. Everything the Agenda tab can do to an entry
 *  goes through here. */
export default function TimetableEntryScreen({ route, navigation }: any) {
  const t = useTheme();
  const { mode, dayIso, dow, event }: Params = route.params ?? { mode: "add" };
  const today = isoDate(new Date());

  const [title, setTitle] = useState(event?.title ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [color, setColor] = useState(event?.color ?? EVENT_COLORS[0]);
  const [repeats, setRepeats] = useState(event ? !event.event_date : true);
  const [dayOfWeek, setDayOfWeek] = useState(event?.day_of_week ?? dow ?? new Date().getDay());
  const [eventDate, setEventDate] = useState(event?.event_date ?? event?.date ?? dayIso ?? today);
  const [starts, setStarts] = useState(() => atLocal(today, event?.starts_at ?? "09:00"));
  const [ends, setEnds] = useState(() => atLocal(today, event?.ends_at ?? "10:00"));
  const [remindMinutes, setRemindMinutes] = useState(
    event?.remind_minutes === undefined || event?.remind_minutes === null ? "" : String(event.remind_minutes)
  );
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [busy, setBusy] = useState(false);

  const startsAt = timeString(starts);
  const endsAt = timeString(ends);

  async function save() {
    if (!title.trim()) return Alert.alert("Give it a name.");
    if (endsAt <= startsAt) return Alert.alert("The end time has to be after the start time.");

    const body = {
      title: title.trim(),
      location: location.trim(),
      notes: notes.trim(),
      color,
      day_of_week: dayOfWeek,
      // Always present, even when null — the server reads a present key as
      // "this is the new value", and an absent one as "leave it alone".
      event_date: repeats ? null : eventDate,
      starts_at: startsAt,
      ends_at: endsAt,
      remind_minutes: remindMinutes === "" ? null : Number(remindMinutes),
      active: event?.active ?? true,
    };

    setBusy(true);
    try {
      if (event) await api.timetable.update(event.id, body);
      else await api.timetable.create(body);
      await refreshReminders();
      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Couldn't save that", err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    if (!event) return;
    Alert.alert("Delete this entry?", event.title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await api.timetable.remove(event.id);
            await refreshReminders();
            navigation.goBack();
          } catch (err: any) {
            Alert.alert("Couldn't delete", err.message);
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={{ backgroundColor: t.paper }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={[styles.label, { color: t.inkMuted }]}>What is it?</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Physics lecture"
        placeholderTextColor={t.inkMuted}
        autoFocus={!event}
        style={[styles.field, { borderColor: t.rule, color: t.ink, backgroundColor: t.page }]}
      />

      <Text style={[styles.label, { color: t.inkMuted }]}>When</Text>
      <View style={[styles.segmented, { backgroundColor: t.page2 }]}>
        {[
          { on: true, label: "Every week" },
          { on: false, label: "Just once" },
        ].map((o) => (
          <Pressable
            key={String(o.on)}
            onPress={() => setRepeats(o.on)}
            style={[styles.segment, { backgroundColor: repeats === o.on ? t.page : "transparent" }]}
          >
            <Text style={{ fontSize: 12.5, color: t.ink, fontWeight: repeats === o.on ? "600" : "400" }}>{o.label}</Text>
          </Pressable>
        ))}
      </View>

      {repeats ? (
        <View style={styles.dayRow}>
          {WEEKDAYS.map((d) => {
            const on = d.dow === dayOfWeek;
            return (
              <Pressable
                key={d.dow}
                onPress={() => setDayOfWeek(d.dow)}
                style={[styles.dayChip, { borderColor: on ? t.accent : t.rule, backgroundColor: on ? t.page2 : "transparent" }]}
              >
                <Text style={{ fontSize: 11, color: on ? t.accent : t.inkMuted, fontWeight: on ? "600" : "400" }}>{d.short}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <>
          <Pressable onPress={() => setShowDate(true)} style={[styles.field, { borderColor: t.rule, backgroundColor: t.page }]}>
            <Text style={{ color: t.ink, fontSize: 14 }}>
              {new Date(`${eventDate}T00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            </Text>
          </Pressable>
          {showDate && (
            <DateTimePicker
              value={new Date(`${eventDate}T00:00`)}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              onChange={(_, selected) => {
                setShowDate(Platform.OS === "ios");
                if (selected) setEventDate(isoDate(selected));
              }}
            />
          )}
        </>
      )}

      <View style={styles.timeRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: t.inkMuted }]}>Starts</Text>
          <Pressable onPress={() => setShowStart(true)} style={[styles.field, { borderColor: t.rule, backgroundColor: t.page }]}>
            <Text style={{ color: t.ink, fontSize: 14, fontFamily: fonts.mono }}>
              {starts.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
            </Text>
          </Pressable>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: t.inkMuted }]}>Ends</Text>
          <Pressable onPress={() => setShowEnd(true)} style={[styles.field, { borderColor: t.rule, backgroundColor: t.page }]}>
            <Text style={{ color: t.ink, fontSize: 14, fontFamily: fonts.mono }}>
              {ends.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
            </Text>
          </Pressable>
        </View>
      </View>
      {showStart && (
        <DateTimePicker
          value={starts}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_, selected) => {
            setShowStart(Platform.OS === "ios");
            if (selected) {
              setStarts(selected);
              // Nudge the end time forward with it so a quick drag doesn't
              // leave an inverted range behind.
              if (toMinutes(timeString(selected)) >= toMinutes(timeString(ends))) {
                const bumped = new Date(selected);
                bumped.setMinutes(bumped.getMinutes() + 60);
                setEnds(bumped);
              }
            }
          }}
        />
      )}
      {showEnd && (
        <DateTimePicker
          value={ends}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_, selected) => {
            setShowEnd(Platform.OS === "ios");
            if (selected) setEnds(selected);
          }}
        />
      )}

      <Text style={[styles.label, { color: t.inkMuted }]}>Colour</Text>
      <View style={styles.colorRow}>
        {EVENT_COLORS.map((hex) => {
          const on = hex === color;
          const shown = t.categoryColor(hex);
          return (
            <Pressable
              key={hex}
              onPress={() => setColor(hex)}
              style={[styles.swatch, { backgroundColor: shown, borderColor: on ? t.ink : "transparent" }]}
            />
          );
        })}
      </View>

      <Text style={[styles.label, { color: t.inkMuted }]}>Where (optional)</Text>
      <TextInput
        value={location}
        onChangeText={setLocation}
        placeholder="Room 204"
        placeholderTextColor={t.inkMuted}
        style={[styles.field, { borderColor: t.rule, color: t.ink, backgroundColor: t.page }]}
      />

      <Text style={[styles.label, { color: t.inkMuted }]}>Remind me</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
        {REMINDER_OPTIONS.map((o) => {
          const on = o.value === remindMinutes;
          return (
            <Pressable
              key={o.value}
              onPress={() => setRemindMinutes(o.value)}
              style={[styles.pillChip, { borderColor: on ? t.accent : t.rule, backgroundColor: on ? t.page2 : "transparent" }]}
            >
              <Text style={{ fontSize: 11.5, color: on ? t.accent : t.inkMuted, fontWeight: on ? "600" : "400" }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={[styles.label, { color: t.inkMuted }]}>Notes (optional)</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Anything worth remembering"
        placeholderTextColor={t.inkMuted}
        multiline
        style={[styles.field, styles.notes, { borderColor: t.rule, color: t.ink, backgroundColor: t.page }]}
      />

      <View style={styles.buttonRow}>
        <Pressable
          onPress={save}
          disabled={busy}
          style={[styles.button, { backgroundColor: t.accent, opacity: busy ? 0.6 : 1 }]}
        >
          <Text style={{ color: t.accentInk, fontWeight: "600", fontSize: 15 }}>{busy ? "Saving…" : "Save"}</Text>
        </Pressable>
        {event && (
          <Pressable onPress={remove} disabled={busy} style={[styles.deleteButton, { borderColor: t.status.critical }]}>
            <Text style={{ color: t.status.critical, fontWeight: "600", fontSize: 15 }}>Delete</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 50 },
  label: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 7, marginTop: 16 },
  field: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14 },
  notes: { minHeight: 70, textAlignVertical: "top" },
  segmented: { flexDirection: "row", borderRadius: 10, padding: 3, gap: 2 },
  segment: { flex: 1, alignItems: "center", borderRadius: 8, paddingVertical: 9 },
  dayRow: { flexDirection: "row", gap: 5 },
  dayChip: { flex: 1, alignItems: "center", borderWidth: 1, borderRadius: 8, paddingVertical: 9 },
  pillChip: { alignItems: "center", borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 12, marginRight: 6 },
  timeRow: { flexDirection: "row", gap: 10, marginTop: 0 },
  colorRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 2 },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 26 },
  button: { flex: 1, borderRadius: 10, padding: 14, alignItems: "center" },
  deleteButton: { borderWidth: 1, borderRadius: 10, padding: 14, alignItems: "center", paddingHorizontal: 20 },
});
