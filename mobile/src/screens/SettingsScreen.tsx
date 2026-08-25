import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView, Switch, Platform } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme, fonts } from "../theme";
import { useAuth } from "../AuthContext";
import { api } from "../api";
import {
  ensurePermission,
  formatTimePref,
  getReminderPrefs,
  setReminderPrefs,
  type ReminderPrefs,
  type TimePref,
  type TogglePref,
} from "../lib/reminders";

const DEFAULTS: ReminderPrefs = {
  workout: { enabled: false, hour: 19, minute: 0 },
  bills: { enabled: false, hour: 10, minute: 0 },
  timetable: { enabled: false },
};

/** Asks for permission the first time it's switched on; without that the
 *  toggle would look enabled while nothing could ever fire. */
async function allow(enabled: boolean) {
  if (!enabled) return true;
  if (await ensurePermission()) return true;
  Alert.alert(
    "Notifications are off",
    "Allow notifications for Khata in your phone's settings, then turn this back on."
  );
  return false;
}

/** A reminder whose timing lives on the thing being reminded about, so there
 *  is no clock to set here — just on or off. */
function ToggleCard({
  title,
  description,
  pref,
  onChange,
}: {
  title: string;
  description: string;
  pref: TogglePref;
  onChange: (next: TogglePref) => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.page2 }]}>
      <View style={styles.switchRow}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ color: t.ink, fontSize: 14, fontWeight: "600" }}>{title}</Text>
          <Text style={{ color: t.inkMuted, fontSize: 11.5, marginTop: 3, lineHeight: 16 }}>{description}</Text>
        </View>
        <Switch
          value={pref.enabled}
          onValueChange={async (enabled) => {
            if (await allow(enabled)) onChange({ enabled });
          }}
          trackColor={{ true: t.accent, false: t.rule }}
        />
      </View>
    </View>
  );
}

/** One reminder: a switch, and — once it's on — the time it fires. */
function ReminderCard({
  title,
  description,
  pref,
  onChange,
}: {
  title: string;
  description: string;
  pref: TimePref;
  onChange: (next: TimePref) => void;
}) {
  const t = useTheme();
  const [picking, setPicking] = useState(false);

  async function toggle(enabled: boolean) {
    if (await allow(enabled)) onChange({ ...pref, enabled });
  }

  return (
    <View style={[styles.card, { backgroundColor: t.page2 }]}>
      <View style={styles.switchRow}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ color: t.ink, fontSize: 14, fontWeight: "600" }}>{title}</Text>
          <Text style={{ color: t.inkMuted, fontSize: 11.5, marginTop: 3, lineHeight: 16 }}>{description}</Text>
        </View>
        <Switch value={pref.enabled} onValueChange={toggle} trackColor={{ true: t.accent, false: t.rule }} />
      </View>

      {pref.enabled && (
        <>
          <Pressable
            onPress={() => setPicking(true)}
            style={[styles.timeButton, { borderColor: t.rule, backgroundColor: t.page }]}
          >
            <Text style={[styles.label, { color: t.inkMuted, marginBottom: 4 }]}>Remind me at</Text>
            <Text style={{ color: t.ink, fontSize: 22, fontFamily: fonts.mono }}>{formatTimePref(pref)}</Text>
          </Pressable>

          {picking && (
            <DateTimePicker
              value={(() => {
                const d = new Date();
                d.setHours(pref.hour, pref.minute, 0, 0);
                return d;
              })()}
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(_, selected) => {
                setPicking(Platform.OS === "ios");
                if (selected) onChange({ ...pref, hour: selected.getHours(), minute: selected.getMinutes() });
              }}
            />
          )}
        </>
      )}
    </View>
  );
}

export default function SettingsScreen() {
  const t = useTheme();
  const { user, serverUrl, signOut } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState<ReminderPrefs>(DEFAULTS);

  useFocusEffect(
    useCallback(() => {
      getReminderPrefs().then(setPrefs);
    }, [])
  );

  async function update(next: ReminderPrefs) {
    setPrefs(next);
    await setReminderPrefs(next);
  }

  async function changePassword() {
    if (!currentPassword || !newPassword) return Alert.alert("Fill in both your current and new password.");
    if (newPassword.length < 8) return Alert.alert("New password must be at least 8 characters.");
    setBusy(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      Alert.alert("Password changed", "Use the new password next time you sign in.");
    } catch (err: any) {
      Alert.alert("Couldn't change password", err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function confirmSignOut() {
    Alert.alert("Sign out?", "You'll need your email and password to get back in.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);
  }

  return (
    <ScrollView style={{ backgroundColor: t.paper }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: t.ink, fontFamily: fonts.display }]}>Settings</Text>

      <View style={[styles.card, { backgroundColor: t.page2 }]}>
        <Text style={[styles.label, { color: t.inkMuted }]}>Signed in as</Text>
        <Text style={{ color: t.ink, fontSize: 15, fontWeight: "600" }}>{user?.name || user?.email}</Text>
        <Text style={{ color: t.inkMuted, fontSize: 12.5, marginTop: 2 }}>{user?.email}</Text>
        <Text style={{ color: t.inkMuted, fontSize: 11, marginTop: 8 }}>Role: {user?.role}</Text>
        <Text style={{ color: t.inkMuted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
          Server: {serverUrl}
        </Text>
      </View>

      <Text style={[styles.sectionLabel, { color: t.inkMuted }]}>Reminders</Text>
      <ReminderCard
        title="Workout"
        description="A daily nudge, skipped automatically on days you've already logged a workout."
        pref={prefs.workout}
        onChange={(workout) => update({ ...prefs, workout })}
      />
      <View style={{ height: 10 }} />
      <ReminderCard
        title="Fixed bills"
        description="For every active bill: one the day before its due date, and another on the day itself if it still isn't logged as paid."
        pref={prefs.bills}
        onChange={(bills) => update({ ...prefs, bills })}
      />
      <View style={{ height: 10 }} />
      <ToggleCard
        title="Timetable"
        description="Each entry fires at its own lead time — set that per entry on the web dashboard."
        pref={prefs.timetable}
        onChange={(timetable) => update({ ...prefs, timetable })}
      />

      <Text style={[styles.sectionLabel, { color: t.inkMuted }]}>Change password</Text>
      <View style={[styles.card, { backgroundColor: t.page2 }]}>
        <TextInput
          value={currentPassword}
          onChangeText={setCurrentPassword}
          placeholder="Current password"
          placeholderTextColor={t.inkMuted}
          secureTextEntry
          style={[styles.input, { borderColor: t.rule, color: t.ink, backgroundColor: t.page }]}
        />
        <TextInput
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="New password (min 8 characters)"
          placeholderTextColor={t.inkMuted}
          secureTextEntry
          style={[styles.input, { borderColor: t.rule, color: t.ink, backgroundColor: t.page, marginTop: 10 }]}
        />
        <Pressable
          onPress={changePassword}
          disabled={busy}
          style={[styles.button, { backgroundColor: t.accent, opacity: busy ? 0.6 : 1 }]}
        >
          <Text style={{ color: t.accentInk, fontWeight: "600", fontSize: 14 }}>
            {busy ? "Saving…" : "Change password"}
          </Text>
        </Pressable>
      </View>

      <Pressable onPress={confirmSignOut} style={[styles.signOut, { borderColor: t.status.critical }]}>
        <Text style={{ color: t.status.critical, fontWeight: "600", fontSize: 14 }}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 50 },
  title: { fontSize: 22, marginBottom: 16 },
  card: { borderRadius: 12, padding: 15 },
  label: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
  sectionLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 22, marginBottom: 8 },
  switchRow: { flexDirection: "row", alignItems: "center" },
  timeButton: { marginTop: 14, borderWidth: 1, borderRadius: 10, padding: 12 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14 },
  button: { marginTop: 16, borderRadius: 10, padding: 12, alignItems: "center" },
  signOut: { marginTop: 28, borderWidth: 1, borderRadius: 10, padding: 13, alignItems: "center" },
});
