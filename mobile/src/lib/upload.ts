import { api } from "../api";

export type UploadedMedia = {
  media_url: string;
  media_public_id: string;
  media_type: "image" | "video";
};

/** Uploads straight to Cloudinary using a signature from our API, so the file
 *  never passes through the server. Returns the fields to save on the
 *  exercise. */
export async function uploadMedia(
  uri: string,
  kind: "image" | "video",
  fileName = "upload"
): Promise<UploadedMedia> {
  const sig = await api.exercises.uploadSignature(kind);

  const form = new FormData();
  // React Native's FormData takes this {uri, name, type} shape rather than a Blob.
  form.append("file", {
    uri,
    name: fileName,
    type: kind === "video" ? "video/mp4" : "image/jpeg",
  } as unknown as Blob);
  form.append("api_key", sig.api_key);
  form.append("timestamp", String(sig.timestamp));
  form.append("folder", sig.folder);
  form.append("signature", sig.signature);

  const res = await fetch(sig.upload_url, { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? "Upload failed.");

  return {
    media_url: data.secure_url,
    media_public_id: data.public_id,
    media_type: kind,
  };
}
