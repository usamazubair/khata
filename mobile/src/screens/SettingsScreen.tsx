import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView } from "react-native";
import { useTheme, fonts } from "../theme";
import { useAuth } from "../AuthContext";
import { api } from "../api";

export default function SettingsScreen() {
  const t = useTheme();
  const { user, serverUrl, signOut } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function changePassword() {
    if (!currentPassword || !newPassword) {
      return Alert.alert("Fill in both your current and new password.");
    }
    if (newPassword.length < 8) {
      return Alert.alert("New password must be at least 8 characters.");
    }
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
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14 },
  button: { marginTop: 16, borderRadius: 10, padding: 12, alignItems: "center" },
  signOut: { marginTop: 28, borderWidth: 1, borderRadius: 10, padding: 13, alignItems: "center" },
});
