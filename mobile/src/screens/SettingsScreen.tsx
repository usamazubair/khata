import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView } from "react-native";
import { useTheme, fonts } from "../theme";
import { api, getServerConfig, setServerConfig } from "../api";

export default function SettingsScreen() {
  const t = useTheme();
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getServerConfig().then((c) => {
      setUrl(c.url);
      setKey(c.key);
    });
  }, []);

  async function save() {
    setSaving(true);
    try {
      const clean = url.trim().replace(/\/+$/, "");
      const ok = await api.health(clean);
      if (!ok) throw new Error("no response");
      await setServerConfig(clean, key);
      Alert.alert("Connected", "Server saved and reachable.");
    } catch {
      Alert.alert("Couldn't reach that server", "Save anyway? Check the URL and that the server is running.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save anyway",
          onPress: async () => {
            await setServerConfig(url, key);
            Alert.alert("Saved", "Settings saved without confirming a connection.");
          },
        },
      ]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: t.paper }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: t.ink, fontFamily: fonts.display }]}>Server</Text>
      <Text style={[styles.sub, { color: t.inkMuted }]}>
        Point the app at your Khata API — a local address while developing, or your Render URL once deployed.
      </Text>

      <Text style={[styles.label, { color: t.inkMuted }]}>API URL</Text>
      <TextInput
        value={url}
        onChangeText={setUrl}
        placeholder="http://192.168.1.20:4000"
        placeholderTextColor={t.inkMuted}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, { borderColor: t.rule, color: t.ink, backgroundColor: t.page }]}
      />

      <Text style={[styles.label, { color: t.inkMuted }]}>API key</Text>
      <TextInput
        value={key}
        onChangeText={setKey}
        placeholder="the shared secret from the server .env"
        placeholderTextColor={t.inkMuted}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        style={[styles.input, { borderColor: t.rule, color: t.ink, backgroundColor: t.page }]}
      />

      <Pressable
        onPress={save}
        disabled={saving || !url || !key}
        style={[styles.button, { backgroundColor: t.accent, opacity: saving || !url || !key ? 0.6 : 1 }]}
      >
        <Text style={[styles.buttonText, { color: t.accentInk }]}>{saving ? "Checking…" : "Save"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 22, marginBottom: 6 },
  sub: { fontSize: 13, lineHeight: 18, marginBottom: 24 },
  label: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 16 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14 },
  button: { marginTop: 28, borderRadius: 10, padding: 14, alignItems: "center" },
  buttonText: { fontWeight: "600", fontSize: 15 },
});
