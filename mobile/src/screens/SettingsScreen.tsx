import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView, Switch, Platform } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme, fonts } from "../theme";
import { useAuth } from "../AuthContext";
import { api } from "../api";
import {
  ensurePermission,
  formatReminderTime,
  getReminderPrefs,
  setReminderPrefs,
  type ReminderPrefs,
} from "../lib/reminders";

export default function SettingsScreen() {
  const t = useTheme();
  const { user, serverUrl, signOut } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const [prefs, setPrefs] = useState<ReminderPrefs>({ enabled: false, hour: 19, minute: 0 });
  const [showTimePicker, setShowTimePicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getReminderPrefs().then(setPrefs);
    }, [])
  );

  async function toggleReminder(enabled: boolean) {
    if (enabled && !(await ensurePermission())) {
      return Alert.alert(
        "Notifications are off",
        "Allow notifications for Khata in your phone's settings, then turn this back on."
      );
    }
    const next = { ...prefs, enabled };
    setPrefs(next);
    await setReminderPrefs(next);
  }

  async function changeTime(hour: number, minute: number) {
    const next = { ...prefs, hour, minute };
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

      <Text style={[styles.sectionLabel, { color: t.inkMuted }]}>Workout reminder</Text>
      <View style={[styles.card, { backgroundColor: t.page2 }]}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: t.ink, fontSize: 14 }}>Daily reminder</Text>
            <Text style={{ color: t.inkMuted, fontSize: 11.5, marginTop: 2 }}>
              Skipped automatically on days you've already logged a workout.
            </Text>
          </View>
          <Switch
            value={prefs.enabled}
            onValueChange={toggleReminder}
            trackColor={{ true: t.accent, false: t.rule }}
          />
        </View>

        {prefs.enabled && (
          <>
            <Pressable
              onPress={() => setShowTimePicker(true)}
              style={[styles.timeButton, { borderColor: t.rule, backgroundColor: t.page }]}
            >
              <Text style={[styles.label, { color: t.inkMuted, marginBottom: 4 }]}>Remind me at</Text>
              <Text style={{ color: t.ink, fontSize: 22, fontFamily: fonts.mono }}>
                {formatReminderTime(prefs)}
              </Text>
            </Pressable>

            {showTimePicker && (
              <DateTimePicker
                value={(() => {
                  const d = new Date();
                  d.setHours(prefs.hour, prefs.minute, 0, 0);
                  return d;
                })()}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_, selected) => {
                  setShowTimePicker(Platform.OS === "ios");
                  if (selected) changeTime(selected.getHours(), selected.getMinutes());
                }}
              />
            )}
          </>
        )}
      </View>

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
