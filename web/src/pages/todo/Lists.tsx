import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { del, get, post, put, seriesColor } from "@/lib/api";
import { rowItem, spring } from "@/lib/motion";
import { Navbar, Page } from "@/components/Shell";
import { CrudLayout } from "@/components/CrudLayout";
import {
  ActiveField,
  ActiveToggle,
  Button,
  ErrorText,
  Field,
  IconButton,
  PageHeader,
  Pill,
  SearchInput,
  TableShell,
  TextInput,
  cx,
} from "@/components/ui";
import { EVENT_COLORS } from "@/lib/timetable";
import { LIST_ICONS } from "@/lib/todo";
import type { TodoList } from "@/lib/types";

export default function Lists() {
  const [rows, setRows] = useState<TodoList[]>([]);
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", icon: LIST_ICONS[0], color: EVENT_COLORS[0], active: true });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await get<TodoList[]>("/api/todo/lists"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function reset() {
    setEditingId(null);
    setForm({ name: "", icon: LIST_ICONS[0], color: EVENT_COLORS[0], active: true });
    setError(null);
  }

  function startEdit(l: TodoList) {
    setEditingId(l.id);
    setForm({ name: l.name, icon: l.icon, color: l.color, active: l.active });
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setError(null);
    try {
      const body = { name: form.name.trim(), icon: form.icon, color: form.color, active: form.active };
      if (editingId) await put(`/api/todo/lists/${editingId}`, body);
      else await post("/api/todo/lists", body);
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

  async function remove(l: TodoList) {
    const total = l.open_count + l.done_count;
    const warning = total
      ? `Delete "${l.name}"? Its ${total} task${total === 1 ? "" : "s"} go with it — this can't be undone.`
      : `Delete "${l.name}"?`;
    if (!confirm(warning)) return;
    if (editingId === l.id) reset();
    await act(() => del(`/api/todo/lists/${l.id}`));
  }

  const filtered = rows.filter((l) => l.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <>
      <Navbar module="todo" />
      <Page>
        <PageHeader eyebrow="Todo" title="Lists" />

        <CrudLayout
          toolbar={<SearchInput value={q} onChange={setQ} placeholder="Search lists…" />}
          footer="Deactivating a list hides it from the board and the app but keeps its tasks. Deleting one takes its tasks with it."
          table={
            <TableShell
              head={
                <>
                  <th className="table-head">List</th>
                  <th className="table-head">Open</th>
                  <th className="table-head">Done</th>
                  <th className="table-head">Status</th>
                  <th className="table-head" />
                </>
              }
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {filtered.map((l) => (
                  <motion.tr
                    key={l.id}
                    variants={rowItem}
                    exit="exit"
                    layout
                    className={cx("border-b border-rule last:border-0", !l.active && "opacity-55")}
                  >
                    <td className="table-cell">
                      <span className="flex items-center gap-2.5">
                        <span
                          className="flex size-7 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `color-mix(in oklab, ${seriesColor(l.color)} 16%, transparent)` }}
                        >
                          {l.icon}
                        </span>
                        {l.name}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="flex items-center gap-2">
                        <span className="num">{l.open_count}</span>
                        {l.overdue_count > 0 && <Pill tone="bad">{l.overdue_count} overdue</Pill>}
                      </span>
                    </td>
                    <td className="table-cell num text-muted">{l.done_count}</td>
                    <td className="table-cell">
                      <ActiveToggle
                        active={l.active}
                        onClick={() => act(() => put(`/api/todo/lists/${l.id}`, { active: !l.active }))}
                      />
                    </td>
                    <td className="table-cell">
                      <div className="flex justify-end gap-1">
                        <IconButton onClick={() => startEdit(l)}>Edit</IconButton>
                        <IconButton className="hover:text-critical" onClick={() => remove(l)}>
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
                    {rows.length ? "No lists match your search." : "No lists yet."}
                  </td>
                </tr>
              )}
            </TableShell>
          }
          formTitle={editingId ? "Edit list" : "Add list"}
          form={
            <form onSubmit={submit}>
              <ErrorText>{error}</ErrorText>

              <Field label="Name">
                <TextInput
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Groceries"
                  required
                />
              </Field>

              <Field label="Icon">
                <div className="flex flex-wrap gap-1.5">
                  {LIST_ICONS.map((icon) => (
                    <motion.button
                      key={icon}
                      type="button"
                      onClick={() => setForm({ ...form, icon })}
                      whileTap={{ scale: 0.88 }}
                      transition={spring}
                      className={cx(
                        "flex size-9 cursor-pointer items-center justify-center rounded-lg border transition-colors",
                        form.icon === icon ? "border-accent bg-accent/12" : "border-rule hover:border-muted"
                      )}
                    >
                      {icon}
                    </motion.button>
                  ))}
                </div>
              </Field>

              <Field label="Colour">
                <div className="flex flex-wrap gap-2">
                  {EVENT_COLORS.map((hex) => (
                    <motion.button
                      key={hex}
                      type="button"
                      onClick={() => setForm({ ...form, color: hex })}
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

              <ActiveField
                active={form.active}
                onChange={(v) => setForm({ ...form, active: v })}
                hint="Inactive lists keep their tasks but disappear from the board and the mobile app."
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
