import { useState } from "react";
import { View, Text, Image, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { api } from "../api";
import { uploadMedia } from "../lib/upload";
import type { Exercise } from "../types";

function VideoDemo({ uri }: { uri: string }) {
  // Demos are short, so loop them muted — it reads as a moving diagram.
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return <VideoView player={player} style={styles.media} contentFit="cover" nativeControls={false} />;
}

/** The demo image or clip attached to an exercise, with the controls to
 *  attach, replace or remove it. */
export default function ExerciseMedia({
  exercise,
  onChange,
}: {
  exercise: Exercise;
  onChange: () => void;
}) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);

  async function pick(kind: "image" | "video") {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      return Alert.alert("Permission needed", "Allow photo access to attach a demo.");
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === "video" ? ["videos"] : ["images"],
      quality: 0.7,
      videoMaxDuration: 15,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setBusy(true);
    try {
      const asset = result.assets[0];
      const media = await uploadMedia(asset.uri, kind, asset.fileName ?? `demo.${kind === "video" ? "mp4" : "jpg"}`);
      await api.exercises.update(exercise.id, media);
      onChange();
    } catch (err: any) {
      Alert.alert("Upload failed", err.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function removeMedia() {
    Alert.alert("Remove demo?", "The file is deleted from storage too.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await api.exercises.update(exercise.id, { media_url: null, media_public_id: null, media_type: null });
            onChange();
          } catch (err: any) {
            Alert.alert("Couldn't remove", err.message);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <View>
      {exercise.media_url ? (
        <View style={[styles.mediaWrap, { borderColor: t.rule, backgroundColor: t.page }]}>
          {exercise.media_type === "video" ? (
            <VideoDemo uri={exercise.media_url} />
          ) : (
            <Image source={{ uri: exercise.media_url }} style={styles.media} resizeMode="cover" />
          )}
          {busy && (
            <View style={styles.overlay}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.placeholder, { borderColor: t.rule }]}>
          <Ionicons name="image-outline" size={22} color={t.inkMuted} />
          <Text style={{ color: t.inkMuted, fontSize: 12, marginTop: 6 }}>No demo attached</Text>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          onPress={() => pick("image")}
          disabled={busy}
          style={[styles.action, { borderColor: t.rule, opacity: busy ? 0.5 : 1 }]}
        >
          <Ionicons name="image-outline" size={14} color={t.inkMuted} />
          <Text style={{ color: t.ink, fontSize: 12 }}>{exercise.media_url ? "Replace photo" : "Add photo"}</Text>
        </Pressable>
        <Pressable
          onPress={() => pick("video")}
          disabled={busy}
          style={[styles.action, { borderColor: t.rule, opacity: busy ? 0.5 : 1 }]}
        >
          <Ionicons name="videocam-outline" size={14} color={t.inkMuted} />
          <Text style={{ color: t.ink, fontSize: 12 }}>{exercise.media_url ? "Replace clip" : "Add clip"}</Text>
        </Pressable>
        {exercise.media_url && (
          <Pressable onPress={removeMedia} disabled={busy} style={[styles.action, { borderColor: t.rule }]}>
            <Ionicons name="trash-outline" size={14} color={t.status.critical} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mediaWrap: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  media: { width: "100%", height: 190, backgroundColor: "#0002" },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "#0006" },
  placeholder: {
    height: 110,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
});
