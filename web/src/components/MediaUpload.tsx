import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Film, ImagePlus, Trash2 } from "lucide-react";
import { post } from "@/lib/api";
import { ease, spring } from "@/lib/motion";
import { Button, ErrorText, cx } from "./ui";

type Signature = {
  timestamp: number;
  folder: string;
  signature: string;
  api_key: string;
  upload_url: string;
};

export type MediaValue = {
  media_url: string | null;
  media_public_id: string | null;
  media_type: "image" | "video" | null;
};

/** Uploads the chosen file straight to Cloudinary using a signature from our
 *  API, so a clip never travels through the server. */
export function MediaUpload({
  value,
  onChange,
  disabled,
}: {
  value: MediaValue;
  onChange: (v: MediaValue) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<"image" | "video">("image");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function choose(next: "image" | "video") {
    setKind(next);
    setError(null);
    // The accept filter has to be set before the picker opens.
    requestAnimationFrame(() => inputRef.current?.click());
  }

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const sig = await post<Signature>("/api/exercises/upload-signature", { resource_type: kind });

      const form = new FormData();
      form.append("file", file);
      form.append("api_key", sig.api_key);
      form.append("timestamp", String(sig.timestamp));
      form.append("folder", sig.folder);
      form.append("signature", sig.signature);

      const res = await fetch(sig.upload_url, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? "Upload failed.");

      onChange({ media_url: data.secure_url, media_public_id: data.public_id, media_type: kind });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={kind === "video" ? "video/*" : "image/*"}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      <AnimatePresence mode="wait" initial={false}>
        {value.media_url ? (
          <motion.div
            key={value.media_url}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={spring}
            className="relative overflow-hidden rounded-xl border border-rule bg-paper"
          >
            {value.media_type === "video" ? (
              // Muted + looping reads as a moving diagram rather than a clip
              // you have to actively play.
              <video src={value.media_url} className="h-44 w-full object-cover" autoPlay muted loop playsInline />
            ) : (
              <img src={value.media_url} alt="Exercise demo" className="h-44 w-full object-cover" />
            )}
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease }}
            className="flex h-28 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-rule text-muted"
          >
            <ImagePlus size={20} />
            <span className="text-xs">No demo attached</span>
          </motion.div>
        )}
      </AnimatePresence>

      {busy && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-xs text-muted">
          Uploading…
        </motion.div>
      )}
      {error && <div className="mt-2"><ErrorText>{error}</ErrorText></div>}

      <div className="mt-2.5 flex flex-wrap gap-2">
        <Button type="button" variant="ghost" disabled={disabled || busy} onClick={() => choose("image")}>
          <span className="flex items-center gap-1.5">
            <ImagePlus size={14} /> {value.media_url ? "Replace photo" : "Add photo"}
          </span>
        </Button>
        <Button type="button" variant="ghost" disabled={disabled || busy} onClick={() => choose("video")}>
          <span className="flex items-center gap-1.5">
            <Film size={14} /> {value.media_url ? "Replace clip" : "Add clip"}
          </span>
        </Button>
        {value.media_url && (
          <Button
            type="button"
            variant="ghost"
            disabled={disabled || busy}
            className={cx("hover:!border-critical hover:!text-critical")}
            onClick={() => onChange({ media_url: null, media_public_id: null, media_type: null })}
          >
            <Trash2 size={14} />
          </Button>
        )}
      </div>
    </div>
  );
}
