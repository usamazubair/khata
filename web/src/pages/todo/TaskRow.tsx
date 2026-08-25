import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Flag, Trash2 } from "lucide-react";
import { del, put, seriesColor } from "@/lib/api";
import { spring } from "@/lib/motion";
import { Button, Field, Select, TextArea, TextInput, cx } from "@/components/ui";
import { PRIORITIES, dueLabel, priority } from "@/lib/todo";
import type { TodoItem } from "@/lib/types";

const TONE = {
  bad: "bg-critical/15 text-critical",
  warn: "bg-warning/20 text-warning",
  neutral: "bg-page2 text-muted",
} as const;

/** One task: tick it, open it to fill in the details, or throw it away.
 *  The row is the whole editor — there's no separate "edit" mode to find. */
export function TaskRow({
  item,
  showList,
  onChanged,
}: {
  item: TodoItem;
  showList?: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: item.title,
    notes: item.notes ?? "",
    due_date: item.due_date ?? "",
    priority: item.priority,
  });
  const [busy, setBusy] = useState(false);

  const due = item.due_date ? dueLabel(item.due_date) : null;
  const pri = priority(item.priority);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await put(`/api/todo/items/${item.id}`, body);
      onChanged();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    await patch({
      title: form.title.trim(),
      notes: form.notes.trim(),
      // Empty means "no date"; the server reads a present-but-null key as a
      // deliberate clear.
      due_date: form.due_date || null,
      priority: form.priority,
    });
    setOpen(false);
  }

  async function remove() {
    if (!confirm(`Delete "${item.title}"?`)) return;
    setBusy(true);
    try {
      await del(`/api/todo/items/${item.id}`);
      onChanged();
    } catch (err) {
      alert((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <motion.div layout className="group border-b border-rule last:border-0">
      <div className="flex items-start gap-3 px-4 py-3">
        <motion.button
          whileTap={{ scale: 0.85 }}
          transition={spring}
          disabled={busy}
          onClick={() => patch({ done: !item.done })}
          aria-label={item.done ? "Mark as not done" : "Mark as done"}
          className={cx(
            "mt-px flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded-md border-2 transition-colors",
            item.done ? "border-good bg-good text-white" : "border-rule hover:border-good"
          )}
        >
          <AnimatePresence>
            {item.done && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={spring}>
                <Check size={12} strokeWidth={3.5} />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        <button
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 cursor-pointer text-left"
        >
          <div className={cx("text-[13.5px] leading-snug", item.done && "text-muted line-through")}>{item.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {showList && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px]"
                style={{
                  backgroundColor: `color-mix(in oklab, ${seriesColor(item.list_color)} 16%, transparent)`,
                  color: seriesColor(item.list_color),
                }}
              >
                {item.list_icon} {item.list_name}
              </span>
            )}
            {due && !item.done && (
              <span className={cx("rounded-full px-2 py-0.5 font-mono text-[10.5px]", TONE[due.tone])}>{due.text}</span>
            )}
            {item.priority > 0 && !item.done && (
              <span className="inline-flex items-center gap-1 text-[10.5px]" style={{ color: pri.color }}>
                <Flag size={10} /> {pri.label}
              </span>
            )}
            {item.notes && !open && <span className="truncate text-[11px] text-muted">{item.notes}</span>}
          </div>
        </button>

        <button
          onClick={remove}
          disabled={busy}
          aria-label="Delete task"
          className="cursor-pointer rounded-md p-1.5 text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-critical focus-visible:opacity-100"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <form onSubmit={save} className="border-t border-rule bg-paper/60 px-4 py-4">
              <Field label="Task">
                <TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Due">
                  <TextInput
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  />
                </Field>
                <Field label="Priority">
                  <Select
                    value={String(form.priority)}
                    onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Notes">
                <TextArea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Anything worth remembering"
                />
              </Field>
              <div className="flex gap-2.5">
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Save"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
