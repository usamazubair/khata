import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { del, get, post, put, seriesColor } from "@/lib/api";
import { rowItem } from "@/lib/motion";
import { EVENT_COLORS } from "@/lib/timetable";
import { Navbar, Page } from "@/components/Shell";
import { CrudLayout } from "@/components/CrudLayout";
import {
  ActiveField,
  ActiveToggle,
  Button,
  Dot,
  ErrorText,
  Field,
  IconButton,
  PageHeader,
  SearchInput,
  TableShell,
  TextInput,
  cx,
} from "@/components/ui";
import type { ExerciseCategory } from "@/lib/types";

export default function ExerciseCategories() {
  const [rows, setRows] = useState<ExerciseCategory[]>([]);
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(EVENT_COLORS[0]);
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await get<ExerciseCategory[]>("/api/exercise-categories"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function reset() {
    setEditingId(null);
    setName("");
    setColor(EVENT_COLORS[0]);
    setActive(true);
    setError(null);
  }

  function startEdit(c: ExerciseCategory) {
    setEditingId(c.id);
    setName(c.name);
    setColor(c.color);
    setActive(c.active);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    try {
      const body = { name: name.trim(), color, active };
      if (editingId) await put(`/api/exercise-categories/${editingId}`, body);
      else await post("/api/exercise-categories", body);
      reset();
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggle(c: ExerciseCategory) {
    try {
      await put(`/api/exercise-categories/${c.id}`, { active: !c.active });
      if (editingId === c.id) setActive(!c.active);
      await load();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function remove(c: ExerciseCategory) {
    if (!confirm(`Delete "${c.name}"? This only works if no exercises use it.`)) return;
    try {
      await del(`/api/exercise-categories/${c.id}`);
      if (editingId === c.id) reset();
      await load();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  const filtered = rows.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <>
      <Navbar module="workout" />
      <Page>
        <PageHeader eyebrow="Workout" title="Categories" />

        <CrudLayout
          toolbar={<SearchInput value={q} onChange={setQ} placeholder="Search categories…" />}
          table={
            <TableShell
              head={
                <>
                  <th className="table-head">Name</th>
                  <th className="table-head">Status</th>
                  <th className="table-head" />
                </>
              }
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {filtered.map((c) => (
                  <motion.tr
                    key={c.id}
                    variants={rowItem}
                    exit="exit"
                    layout
                    className={cx("border-b border-rule last:border-0", !c.active && "opacity-55")}
                  >
                    <td className="table-cell">
                      <span className="flex items-center gap-2.5">
                        <Dot color={seriesColor(c.color)} /> {c.name}
                      </span>
                    </td>
                    <td className="table-cell">
                      <ActiveToggle active={c.active} onClick={() => toggle(c)} />
                    </td>
                    <td className="table-cell">
                      <div className="flex justify-end gap-1">
                        <IconButton onClick={() => startEdit(c)}>Edit</IconButton>
                        <IconButton onClick={() => remove(c)} className="hover:text-critical">
                          Delete
                        </IconButton>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="table-cell text-muted">
                    {rows.length ? "No categories match your search." : "No categories yet."}
                  </td>
                </tr>
              )}
            </TableShell>
          }
          formTitle={editingId ? "Edit category" : "Add category"}
          form={
            <form onSubmit={submit}>
              <ErrorText>{error}</ErrorText>

              <Field label="Name">
                <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Chest" required />
              </Field>

              <Field label="Colour">
                <div className="flex flex-wrap gap-2">
                  {EVENT_COLORS.map((hex) => (
                    <motion.button
                      key={hex}
                      type="button"
                      onClick={() => setColor(hex)}
                      whileTap={{ scale: 0.88 }}
                      whileHover={{ scale: 1.12 }}
                      className={cx(
                        "size-7 cursor-pointer rounded-full border-2 transition-colors",
                        color === hex ? "border-ink" : "border-transparent"
                      )}
                      style={{ backgroundColor: seriesColor(hex) }}
                      aria-label={hex}
                    />
                  ))}
                </div>
              </Field>

              <ActiveField
                active={active}
                onChange={setActive}
                hint="Inactive categories keep their exercises but stop being offered as a choice."
              />

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
