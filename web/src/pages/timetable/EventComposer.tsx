import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Trash2 } from "lucide-react";
import { del, post, put, seriesColor } from "@/lib/api";
import { spring } from "@/lib/motion";
import { Button, ErrorText, Field, Modal, Select, TextArea, TextInput, cx } from "@/components/ui";
import { EVENT_COLORS, REMINDER_OPTIONS, WEEKDAYS, isoDate } from "@/lib/timetable";
import type { TimetableEvent } from "@/lib/types";

export type Draft = {
  id?: number;
  title: string;
  location: string;
  notes: string;
  color: string;
  repeats: boolean;
  day_of_week: number;
  event_date: string;
  starts_at: string;
  ends_at: string;
  remind_minutes: string;
  active: boolean;
};

export function blankDraft(day: Date, dow: number, startHour: number): Draft {
  const start = Math.min(startHour, 23);
  return {
    title: "",
    location: "",
    notes: "",
    color: EVENT_COLORS[0],
    repeats: true,
    day_of_week: dow,
    event_date: isoDate(day),
    starts_at: `${String(start).padStart(2, "0")}:00`,
    ends_at: `${String(Math.min(start + 1, 23)).padStart(2, "0")}:00`,
    remind_minutes: "",
    active: true,
  };
}

export function draftFrom(e: TimetableEvent, fallbackDate: string): Draft {
  return {
    id: e.id,
    title: e.title,
    location: e.location ?? "",
    notes: e.notes ?? "",
    color: e.color,
    repeats: !e.event_date,
    day_of_week: e.day_of_week,
    event_date: e.event_date ?? fallbackDate,
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    remind_minutes: e.remind_minutes === null ? "" : String(e.remind_minutes),
    active: e.active,
  };
}

/** Add / edit / delete one timetable entry. Everything the grid can do to an
 *  entry goes through here, so the week view stays about layout. */
export function EventComposer({
  draft,
  onClose,
  onSaved,
}: {
  draft: Draft | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Draft | null>(draft);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm(draft);
    setError(null);
  }, [draft]);

  if (!form) return null;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setForm({ ...form, [key]: value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);

    if (!form.title.trim()) return setError("Give it a name.");
    if (form.ends_at <= form.starts_at) return setError("The end time has to be after the start time.");

    const body = {
      title: form.title.trim(),
      location: form.location.trim(),
      notes: form.notes.trim(),
      color: form.color,
      // Sending both keys every time is what lets you flip an entry between
      // repeating and one-off; the server derives the weekday from a date.
      day_of_week: form.day_of_week,
      event_date: form.repeats ? null : form.event_date,
      starts_at: form.starts_at,
      ends_at: form.ends_at,
      remind_minutes: form.remind_minutes === "" ? null : Number(form.remind_minutes),
      active: form.active,
    };

    setBusy(true);
    try {
      if (form.id) await put(`/api/timetable/${form.id}`, body);
      else await post("/api/timetable", body);
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!form?.id) return;
    if (!confirm(`Delete "${form.title}"?`)) return;
    setBusy(true);
    try {
      await del(`/api/timetable/${form.id}`);
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={form.id ? "Edit entry" : "New entry"}>
      <form onSubmit={submit}>
        <ErrorText>{error}</ErrorText>

        <Field label="What is it?">
          <TextInput
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Physics lecture"
            autoFocus
            required
          />
        </Field>

        <Field label="When">
          <div className="mb-2.5 flex gap-1 rounded-xl bg-page2 p-1">
            {[
              { on: true, label: "Every week" },
              { on: false, label: "Just once" },
            ].map((o) => (
              <button
                key={String(o.on)}
                type="button"
                onClick={() => set("repeats", o.on)}
                className="relative flex-1 cursor-pointer rounded-lg px-3 py-1.5 text-xs"
              >
                {form.repeats === o.on && (
                  <motion.span layoutId="repeat-mode" className="absolute inset-0 rounded-lg bg-page shadow-sm" transition={spring} />
                )}
                <span className={cx("relative", form.repeats === o.on ? "font-semibold text-ink" : "text-muted")}>
                  {o.label}
                </span>
              </button>
            ))}
          </div>

          {form.repeats ? (
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.dow}
                  type="button"
                  onClick={() => set("day_of_week", d.dow)}
                  className={cx(
                    "cursor-pointer rounded-lg border py-2 text-[11px] transition-colors",
                    form.day_of_week === d.dow
                      ? "border-accent bg-accent/12 font-semibold text-accent"
                      : "border-rule text-muted hover:text-ink"
                  )}
                >
                  {d.short}
                </button>
              ))}
            </div>
          ) : (
            <TextInput type="date" value={form.event_date} onChange={(e) => set("event_date", e.target.value)} required />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts">
            <TextInput type="time" value={form.starts_at} onChange={(e) => set("starts_at", e.target.value)} required />
          </Field>
          <Field label="Ends">
            <TextInput type="time" value={form.ends_at} onChange={(e) => set("ends_at", e.target.value)} required />
          </Field>
        </div>

        <Field label="Colour">
          <div className="flex flex-wrap gap-2">
            {EVENT_COLORS.map((hex) => (
              <motion.button
                key={hex}
                type="button"
                onClick={() => set("color", hex)}
                whileTap={{ scale: 0.88 }}
                whileHover={{ scale: 1.12 }}
                transition={spring}
                className={cx(
                  "size-7 cursor-pointer rounded-full border-2 transition-colors",
                  form.color === hex ? "border-ink" : "border-transparent"
                )}
                style={{ backgroundColor: seriesColor(hex) }}
                aria-label={hex}
              />
            ))}
          </div>
        </Field>

        <Field label="Where (optional)">
          <TextInput value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Room 204" />
        </Field>

        <Field label="Remind me" hint="Reminders fire on your phone. Turn Timetable reminders on in the app's Settings.">
          <Select value={form.remind_minutes} onChange={(e) => set("remind_minutes", e.target.value)}>
            {REMINDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Notes (optional)">
          <TextArea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything worth remembering" />
        </Field>

        <div className="mt-5 flex items-center gap-2.5">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {form.id && (
            <Button type="button" variant="danger" className="ml-auto" onClick={remove} disabled={busy}>
              <span className="flex items-center gap-1.5">
                <Trash2 size={14} /> Delete
              </span>
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
