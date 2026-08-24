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
  Dot,
  ErrorText,
  Field,
  FilterChips,
  IconButton,
  PageHeader,
  SearchInput,
  TableShell,
  TextInput,
  cx,
} from "@/components/ui";
import type { Category, CategoryType } from "@/lib/types";

const TYPES: CategoryType[] = ["expense", "fixed", "saved", "budget"];
const FILTERS: { value: CategoryType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "expense", label: "Expense" },
  { value: "fixed", label: "Fixed" },
  { value: "saved", label: "Saved" },
  { value: "budget", label: "Budgets" },
];
const SWATCHES = ["#2f6bff", "#f4661f", "#00b37e", "#f0a500", "#e0459c", "#12b0c9", "#7b3ff2", "#e33b4e"];

export default function Categories() {
  const [rows, setRows] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<CategoryType | "all">("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("expense");
  const [color, setColor] = useState(SWATCHES[0]);
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await get<Category[]>("/api/categories"));
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
    setType("expense");
    setColor(SWATCHES[0]);
    setActive(true);
    setError(null);
  }

  function startEdit(c: Category) {
    setEditingId(c.id);
    setName(c.name);
    setType(c.type);
    setColor(c.color);
    setActive(c.active);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    try {
      const body = { name: name.trim(), type, color, active };
      if (editingId) await put(`/api/categories/${editingId}`, body);
      else await post("/api/categories", body);
      reset();
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggle(c: Category) {
    try {
      await put(`/api/categories/${c.id}`, { active: !c.active });
      if (editingId === c.id) setActive(!c.active);
      await load();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function remove(c: Category) {
    if (!confirm(`Delete "${c.name}"? This only works if nothing references it.`)) return;
    try {
      await del(`/api/categories/${c.id}`);
      if (editingId === c.id) reset();
      await load();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  const matchesSearch = (c: Category) => c.name.toLowerCase().includes(q.trim().toLowerCase());
  // Counts come from the search results, not the whole table, so the numbers
  // on the chips always describe what clicking one would actually show.
  const searched = rows.filter(matchesSearch);
  const filtered = searched.filter((c) => typeFilter === "all" || c.type === typeFilter);
  const counts = FILTERS.map((f) => ({
    ...f,
    count: f.value === "all" ? searched.length : searched.filter((c) => c.type === f.value).length,
  }));

  return (
    <>
      <Navbar module="transactions" />
      <Page>
        <PageHeader eyebrow="Transactions" title="Categories" />

        <CrudLayout
          toolbar={
            <div className="w-full space-y-3">
              <SearchInput value={q} onChange={setQ} placeholder="Search categories…" />
              <FilterChips options={counts} value={typeFilter} onChange={setTypeFilter} />
            </div>
          }
          table={
            <TableShell
              head={
                <>
                  <th className="table-head">Name</th>
                  <th className="table-head">Slug</th>
                  <th className="table-head">Type</th>
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
                    <td className="table-cell font-mono text-[11px] text-muted">{c.slug}</td>
                    <td className="table-cell text-muted">{c.type}</td>
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
                  <td colSpan={5} className="table-cell text-muted">
                    {rows.length ? "No categories match those filters." : "No categories yet."}
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
                <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Groceries" required />
              </Field>

              <Field label="Type">
                <div className="flex flex-wrap gap-1.5">
                  {TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={cx(
                        "relative flex-1 cursor-pointer rounded-lg border px-2 py-2 text-xs transition-colors",
                        type === t ? "border-accent text-ink" : "border-rule text-muted hover:text-ink"
                      )}
                    >
                      {type === t && (
                        <motion.span
                          layoutId="cat-type"
                          className="absolute inset-0 rounded-lg bg-accent/12"
                          transition={spring}
                        />
                      )}
                      <span className="relative">{t}</span>
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Colour">
                <div className="flex flex-wrap gap-2">
                  {SWATCHES.map((hex) => (
                    <motion.button
                      key={hex}
                      type="button"
                      onClick={() => setColor(hex)}
                      whileTap={{ scale: 0.88 }}
                      whileHover={{ scale: 1.12 }}
                      transition={spring}
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
                hint="Inactive categories keep their transactions but stop being offered in the mobile app."
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
