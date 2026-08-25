import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "react-router-dom";
import { ChevronDown, Inbox, Plus } from "lucide-react";
import { del, get, post, seriesColor } from "@/lib/api";
import { hoverLift, riseItem, spring, staggerParent } from "@/lib/motion";
import { Navbar, Page } from "@/components/Shell";
import { Button, EmptyState, PageHeader, ProgressBar, SearchInput, Select, TextInput, cx } from "@/components/ui";
import { TaskRow } from "./TaskRow";
import type { TodoItem, TodoList } from "@/lib/types";

/** The pseudo-list that shows everything at once. */
const ALL = -1;

export default function Board() {
  const [lists, setLists] = useState<TodoList[]>([]);
  const [items, setItems] = useState<TodoItem[]>([]);
  const [selected, setSelected] = useState<number>(ALL);
  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  const [addTo, setAddTo] = useState<string>("");
  const [showDone, setShowDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [l, i] = await Promise.all([
        get<TodoList[]>("/api/todo/lists?active=true"),
        get<TodoItem[]>("/api/todo/items"),
      ]);
      setLists(l);
      setItems(i);
      setAddTo((prev) => prev || String(l[0]?.id ?? ""));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // A list that gets deactivated shouldn't leave the board pointing at nothing.
  useEffect(() => {
    if (selected !== ALL && lists.length && !lists.some((l) => l.id === selected)) setSelected(ALL);
  }, [lists, selected]);

  const activeList = lists.find((l) => l.id === selected) ?? null;
  const targetListId = activeList ? activeList.id : Number(addTo);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items
      .filter((i) => selected === ALL || i.list_id === selected)
      .filter((i) => !needle || `${i.title} ${i.notes}`.toLowerCase().includes(needle));
  }, [items, selected, q]);

  const open = visible.filter((i) => !i.done);
  const done = visible.filter((i) => i.done);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !targetListId) return;
    setBusy(true);
    try {
      await post("/api/todo/items", { list_id: targetListId, title: title.trim() });
      setTitle("");
      await load();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function clearDone() {
    if (!activeList) return;
    if (!confirm(`Delete the ${done.length} finished task${done.length === 1 ? "" : "s"} on ${activeList.name}?`)) return;
    try {
      await del(`/api/todo/lists/${activeList.id}/done`);
      await load();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  const totalOpen = lists.reduce((n, l) => n + l.open_count, 0);
  const totalDone = lists.reduce((n, l) => n + l.done_count, 0);

  return (
    <>
      <Navbar module="todo" />
      <Page wide>
        <PageHeader eyebrow="Todo" title={activeList ? activeList.name : "Everything"} />

        {error && <EmptyState>{error}</EmptyState>}

        <div className="grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
          {/* ── the cards ─────────────────────────────────────────────── */}
          <motion.div variants={staggerParent} initial="hidden" animate="show" className="min-w-0 space-y-2">
            <ListCard
              icon={<Inbox size={16} />}
              name="Everything"
              tint="var(--accent)"
              openCount={totalOpen}
              doneCount={totalDone}
              selected={selected === ALL}
              onSelect={() => setSelected(ALL)}
            />

            {lists.map((l) => (
              <ListCard
                key={l.id}
                icon={<span className="text-base leading-none">{l.icon}</span>}
                name={l.name}
                tint={seriesColor(l.color)}
                openCount={l.open_count}
                doneCount={l.done_count}
                overdue={l.overdue_count}
                selected={selected === l.id}
                onSelect={() => setSelected(l.id)}
              />
            ))}

            <Link
              to="/todo/lists"
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-rule px-4 py-3 text-[12.5px] text-muted transition-colors hover:border-accent/60 hover:text-ink"
            >
              <Plus size={14} /> Manage lists
            </Link>
          </motion.div>

          {/* ── the tasks ─────────────────────────────────────────────── */}
          <div className="min-w-0">
            <form onSubmit={add} className="surface mb-3 flex flex-wrap items-center gap-2 p-2">
              <span className="pl-2 text-muted">
                <Plus size={16} />
              </span>
              <TextInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={activeList ? `Add to ${activeList.name}…` : "Add a task…"}
                className="min-w-40 flex-1 border-0! bg-transparent! focus:ring-0!"
              />
              {/* With no list selected there's nothing to infer, so pick one. */}
              {!activeList && lists.length > 0 && (
                <Select value={addTo} onChange={(e) => setAddTo(e.target.value)} className="w-auto">
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.icon} {l.name}
                    </option>
                  ))}
                </Select>
              )}
              <Button type="submit" disabled={busy || !title.trim() || !targetListId}>
                Add
              </Button>
            </form>

            {lists.length === 0 && (
              <p className="mb-3 text-[13px] text-muted">
                No lists yet — <Link to="/todo/lists" className="text-accent underline">make one first</Link>.
              </p>
            )}

            <div className="mb-3">
              <SearchInput value={q} onChange={setQ} placeholder="Search tasks…" />
            </div>

            <div className="surface overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false}>
                {open.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={spring}
                  >
                    <TaskRow item={item} showList={selected === ALL} onChanged={load} />
                  </motion.div>
                ))}
              </AnimatePresence>

              {open.length === 0 && (
                <p className="px-4 py-8 text-center text-[13px] text-muted">
                  {items.length === 0
                    ? "Nothing here yet. Add your first task above."
                    : q
                      ? "No tasks match your search."
                      : "All clear. 🎉"}
                </p>
              )}
            </div>

            {done.length > 0 && (
              <div className="mt-3">
                <div className="mb-2 flex items-center gap-2">
                  <button
                    onClick={() => setShowDone((v) => !v)}
                    className="flex cursor-pointer items-center gap-1.5 text-[12.5px] text-muted transition-colors hover:text-ink"
                  >
                    <motion.span animate={{ rotate: showDone ? 0 : -90 }} transition={spring} className="flex">
                      <ChevronDown size={14} />
                    </motion.span>
                    Done ({done.length})
                  </button>
                  {activeList && showDone && (
                    <button
                      onClick={clearDone}
                      className="ml-auto cursor-pointer text-[12px] text-muted transition-colors hover:text-critical"
                    >
                      Clear finished
                    </button>
                  )}
                </div>

                <AnimatePresence initial={false}>
                  {showDone && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.24 }}
                      className="overflow-hidden"
                    >
                      <div className="surface overflow-hidden">
                        {done.map((item) => (
                          <TaskRow key={item.id} item={item} showList={selected === ALL} onChanged={load} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </Page>
    </>
  );
}

function ListCard({
  icon,
  name,
  tint,
  openCount,
  doneCount,
  overdue = 0,
  selected,
  onSelect,
}: {
  icon: React.ReactNode;
  name: string;
  tint: string;
  openCount: number;
  doneCount: number;
  overdue?: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const total = openCount + doneCount;
  const pct = total ? (doneCount / total) * 100 : 0;

  return (
    <motion.button
      variants={riseItem}
      whileHover={hoverLift}
      transition={spring}
      onClick={onSelect}
      style={{ ["--tint" as string]: tint }}
      className={cx(
        "surface relative w-full cursor-pointer overflow-hidden px-4 py-3 text-left transition-colors",
        selected ? "border-[var(--tint)]" : "hover:border-[var(--tint)]/60"
      )}
    >
      {selected && (
        <motion.span
          layoutId="list-selected"
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ background: "var(--tint)" }}
          transition={spring}
        />
      )}
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `color-mix(in oklab, ${tint} 16%, transparent)`, color: tint }}>
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{name}</span>
        <span className="num text-[13px] text-muted">{openCount}</span>
      </div>

      <div className="mt-2.5">
        <ProgressBar pct={pct} color={tint} />
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-[10.5px] text-muted">
        <span>{total ? `${doneCount} of ${total} done` : "Nothing yet"}</span>
        {overdue > 0 && <span className="ml-auto text-critical">{overdue} overdue</span>}
      </div>
    </motion.button>
  );
}
