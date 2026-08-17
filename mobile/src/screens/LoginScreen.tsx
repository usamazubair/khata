import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useTheme, fonts } from "../theme";
import { useAuth } from "../AuthContext";

export default function LoginScreen() {
  const t = useTheme();
  const { signIn, serverUrl } = useAuth();
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Prefill the server address once it's been entered — you only type it once.
  useEffect(() => {
    if (serverUrl) setUrl(serverUrl);
  }, [serverUrl]);

  async function submit() {
    if (!url.trim() || !email.trim() || !password) {
      return setError("Server address, email and password are all required.");
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(url, email, password);
    } catch (err: any) {
      setError(err.message || "Couldn't sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.paper }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={[styles.wordmark, { color: t.ink, fontFamily: fonts.display }]}>Khata</Text>
        <Text style={[styles.tagline, { color: t.inkMuted, fontFamily: fonts.display }]}>Your ledger, in your pocket.</Text>

        <View style={[styles.card, { backgroundColor: t.page2 }]}>
          <Text style={[styles.label, { color: t.inkMuted }]}>Server address</Text>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="https://khata-xxxx.onrender.com"
            placeholderTextColor={t.inkMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={[styles.input, { borderColor: t.rule, color: t.ink, backgroundColor: t.page }]}
          />

          <Text style={[styles.label, { color: t.inkMuted }]}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={t.inkMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            style={[styles.input, { borderColor: t.rule, color: t.ink, backgroundColor: t.page }]}
          />

          <Text style={[styles.label, { color: t.inkMuted }]}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            placeholderTextColor={t.inkMuted}
            secureTextEntry
            textContentType="password"
            onSubmitEditing={submit}
            returnKeyType="go"
            style={[styles.input, { borderColor: t.rule, color: t.ink, backgroundColor: t.page }]}
          />

          {error && <Text style={[styles.error, { color: t.status.critical }]}>{error}</Text>}

          <Pressable
            onPress={submit}
            disabled={busy}
            style={[styles.button, { backgroundColor: t.accent, opacity: busy ? 0.6 : 1 }]}
          >
            <Text style={{ color: t.accentInk, fontWeight: "600", fontSize: 15 }}>{busy ? "Signing in…" : "Sign in"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", padding: 24 },
  wordmark: { fontSize: 40, textAlign: "center" },
  tagline: { fontSize: 15, fontStyle: "italic", textAlign: "center", marginBottom: 28 },
  card: { borderRadius: 16, padding: 20 },
  label: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14 },
  error: { fontSize: 12.5, marginTop: 14 },
  button: { marginTop: 22, borderRadius: 10, padding: 14, alignItems: "center" },
});
