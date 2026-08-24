import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { del, get, post, put } from "@/lib/api";
import { rowItem } from "@/lib/motion";
import { Navbar, Page } from "@/components/Shell";
import { CrudLayout } from "@/components/CrudLayout";
import {
  ActiveToggle,
  Button,
  ErrorText,
  Field,
  IconButton,
  PageHeader,
  SearchInput,
  TableShell,
  TextArea,
  TextInput,
  cx,
} from "@/components/ui";
import type { Exercise } from "@/lib/types";

export default function Exercises() {
  const [rows, setRows] = useState<Exercise[]>([]);
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", muscle_group: "", equipment: "", notes: "" });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await get<Exercise[]>("/api/exercises"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function reset() {
    setEditingId(null);
    setForm({ name: "", muscle_group: "", equipment: "", notes: "" });
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const body = {
      name: form.name.trim(),
      muscle_group: form.muscle_group.trim(),
      equipment: form.equipment.trim(),
      notes: form.notes.trim(),
    };
    if (!body.name) return;
    try {
      if (editingId) await put(`/api/exercises/${editingId}`, body);
      else await post("/api/exercises", body);
      reset();
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      await load();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  const filtered = rows.filter((x) =>
    `${x.name} ${x.muscle_group} ${x.equipment}`.toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <>
      <Navbar module="workout" />
      <Page>
        <PageHeader eyebrow="Workout" title="Exercises" />
        <p className="mb-4 text-xs text-muted">
          Your exercise library. Deactivated exercises stay in past sessions but stop appearing when you log new sets.
        </p>

        <CrudLayout
          toolbar={<SearchInput value={q} onChange={setQ} placeholder="Search exercises…" />}
          table={
            <TableShell
              head={
                <>
                  <th className="table-head">Name</th>
                  <th className="table-head">Muscle group</th>
                  <th className="table-head">Equipment</th>
                  <th className="table-head">Status</th>
                  <th className="table-head" />
                </>
              }
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {filtered.map((x) => (
                  <motion.tr
                    key={x.id}
                    variants={rowItem}
                    exit="exit"
                    layout
                    className={cx("border-b border-rule last:border-0", !x.active && "opacity-55")}
                  >
                    <td className="table-cell">{x.name}</td>
                    <td className="table-cell text-muted">{x.muscle_group || "—"}</td>
                    <td className="table-cell text-muted">{x.equipment || "—"}</td>
                    <td className="table-cell">
                      <ActiveToggle active={x.active} onClick={() => act(() => put(`/api/exercises/${x.id}`, { active: !x.active }))} />
                    </td>
                    <td className="table-cell">
                      <div className="flex justify-end gap-1">
                        <IconButton
                          onClick={() => {
                            setEditingId(x.id);
                            setForm({
                              name: x.name,
                              muscle_group: x.muscle_group ?? "",
                              equipment: x.equipment ?? "",
                              notes: x.notes ?? "",
                            });
                          }}
                        >
                          Edit
                        </IconButton>
                        <IconButton
                          className="hover:text-critical"
                          onClick={() => {
                            if (confirm(`Delete "${x.name}"? This only works if no sets reference it.`))
                              act(() => del(`/api/exercises/${x.id}`));
                          }}
                        >
                          Delete
                        </IconButton>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-cell text-muted">
                    {rows.length ? "Nothing matches your search." : "No exercises yet."}
                  </td>
                </tr>
              )}
            </TableShell>
          }
          formTitle={editingId ? "Edit exercise" : "Add exercise"}
          form={
            <form onSubmit={submit}>
              <ErrorText>{error}</ErrorText>
              <Field label="Name">
                <TextInput
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Bench Press"
                  required
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Muscle group">
                  <TextInput
                    value={form.muscle_group}
                    onChange={(e) => setForm({ ...form, muscle_group: e.target.value })}
                    placeholder="Chest"
                  />
                </Field>
                <Field label="Equipment">
                  <TextInput
                    value={form.equipment}
                    onChange={(e) => setForm({ ...form, equipment: e.target.value })}
                    placeholder="Barbell"
                  />
                </Field>
              </div>
              <Field label="Notes">
                <TextArea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Form cues, setup, anything worth remembering"
                />
              </Field>
              <div className="mt-4 flex gap-2.5">
                <Button type="submit">Save</Button>
                {editingId && (
                  <Button type="button" variant="ghost" onClick={reset}>
                    Cancel edit
                  </Button>
                )}
              </div>
            </form>
          }
        />
      </Page>
    </>
  );
}
