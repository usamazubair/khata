import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { del, get, parseDate, post, put, seriesColor } from "@/lib/api";
import { rowItem, spring } from "@/lib/motion";
import { WEEKDAYS, isoDate, addDays } from "@/lib/timetable";
import { Navbar, Page } from "@/components/Shell";
import { CrudLayout } from "@/components/CrudLayout";
import {
  ActiveToggle,
  Button,
  Dot,
  ErrorText,
  Field,
  IconButton,
  PageHeader,
  Pill,
  TableShell,
  TextInput,
  cx,
} from "@/components/ui";
import type { Exercise, WorkoutPlan } from "@/lib/types";

type PlanExercise = { exercise_id: number; name: string; category_name: string; category_color: string };

const dayName = (dow: number) => WEEKDAYS.find((d) => d.dow === dow)?.long ?? "";

/** The next date `dow` falls on, today included. */
function nextOccurrence(dow: number): string {
  const now = new Date();
  const delta = (dow - now.getDay() + 7) % 7;
  return isoDate(addDays(now, delta));
}

export default function Plans() {
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [repeat, setRepeat] = useState(true);
  const [rotate, setRotate] = useState(false);
  const [week, setWeek] = useState(1);
  const [list, setList] = useState<PlanExercise[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, x] = await Promise.all([
        get<WorkoutPlan[]>("/api/workout-plans"),
        get<Exercise[]>("/api/exercises?active=true"),
      ]);
      setPlans(p);
      setExercises(x);
      setError(null);
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
    setSelectedDays([]);
    setRepeat(true);
    setRotate(false);
    setWeek(1);
    setList([]);
    setCategoryFilter("All");
    setError(null);
  }

  function startEdit(p: WorkoutPlan) {
    setEditingId(p.id);
    setName(p.name);
    setSelectedDays(p.day_of_week !== null ? [p.day_of_week] : []);
    setRepeat(!p.event_date);
    // Anything other than sort_order 1 was deliberately given a week
    // number, so it reads as "rotating" -- a fresh plan always starts at 1.
    setRotate(!p.event_date && p.sort_order !== 1);
    setWeek(p.sort_order || 1);
    setList(p.exercises.map((e) => ({ exercise_id: e.exercise_id, name: e.name, category_name: e.category_name, category_color: e.category_color })));
    setCategoryFilter("All");
    setError(null);
  }

  function toggleDay(dow: number) {
    setSelectedDays((prev) => (prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow].sort()));
  }

  function addExercise(x: Exercise) {
    if (list.some((l) => l.exercise_id === x.id)) return;
    setList((prev) => [...prev, { exercise_id: x.id, name: x.name, category_name: x.category_name, category_color: x.category_color }]);
  }

  function removeExercise(id: number) {
    setList((prev) => prev.filter((l) => l.exercise_id !== id));
  }

  function move(index: number, dir: -1 | 1) {
    setList((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Give the plan a name.");
    if (selectedDays.length === 0) return setError("Pick at least one day.");
    setSaving(true);
    setError(null);
    try {
      const bodies = selectedDays.map((dow) =>
        repeat
          ? { name: name.trim(), day_of_week: dow, event_date: null, sort_order: rotate ? week : 1 }
          : { name: name.trim(), event_date: nextOccurrence(dow) }
      );

      const ids: number[] = [];
      if (editingId) {
        await put(`/api/workout-plans/${editingId}`, bodies[0]);
        ids.push(editingId);
        for (const body of bodies.slice(1)) ids.push((await post<WorkoutPlan>("/api/workout-plans", body)).id);
      } else {
        for (const body of bodies) ids.push((await post<WorkoutPlan>("/api/workout-plans", body)).id);
      }
      await Promise.all(
        ids.map((id) => put(`/api/workout-plans/${id}/exercises`, { exercise_ids: list.map((l) => l.exercise_id) }))
      );
      reset();
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(p: WorkoutPlan) {
    try {
      await put(`/api/workout-plans/${p.id}`, { active: !p.active });
      await load();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function remove(p: WorkoutPlan) {
    if (!confirm(`Delete "${p.name}"?`)) return;
    try {
      await del(`/api/workout-plans/${p.id}`);
      if (editingId === p.id) reset();
      await load();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function removeAll() {
    if (plans.length === 0) return;
    if (!confirm(`Remove all ${plans.length} plans? This can't be undone.`)) return;
    for (const p of plans) {
      try {
        await del(`/api/workout-plans/${p.id}`);
      } catch {
        await put(`/api/workout-plans/${p.id}`, { active: false });
      }
    }
    reset();
    await load();
  }

  // All repeating plans sharing a weekday, in rotation order -- sort_order
  // 1 with no siblings reads as "just always this plan"; more than one, or
  // a sort_order other than 1, is a deliberate multi-week rotation.
  const weekdayGroup = (dow: number) => plans.filter((p) => p.day_of_week === dow && !p.event_date);
  const cyclePlans = plans.filter((p) => p.day_of_week === null && !p.event_date);

  async function moveWeekdayPlan(p: WorkoutPlan, dir: -1 | 1) {
    const group = weekdayGroup(p.day_of_week!);
    const idx = group.findIndex((x) => x.id === p.id);
    const other = group[idx + dir];
    if (!other) return;
    try {
      await Promise.all([
        put(`/api/workout-plans/${p.id}`, { sort_order: other.sort_order }),
        put(`/api/workout-plans/${other.id}`, { sort_order: p.sort_order }),
      ]);
      await load();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  const categoryNames = Array.from(new Set(exercises.map((x) => x.category_name))).sort();
  const availableToAdd = exercises
    .filter((x) => !list.some((l) => l.exercise_id === x.id))
    .filter((x) => categoryFilter === "All" || x.category_name === categoryFilter);

  // Instant feedback before even saving, for the exact thing the server
  // will otherwise reject.
  const weekConflict =
    repeat && rotate
      ? selectedDays
          .map((dow) => weekdayGroup(dow).find((p) => p.sort_order === week && p.id !== editingId))
          .find((p): p is WorkoutPlan => !!p)
      : undefined;

  return (
    <>
      <Navbar module="workout" />
      <Page>
        <PageHeader eyebrow="Workout" title="Plans">
          {plans.length > 0 && (
            <Button variant="danger" onClick={removeAll} type="button">
              Remove all plans
            </Button>
          )}
        </PageHeader>
        <p className="mb-4 text-xs text-muted">
          Pick which day(s) a plan is for. Repeat it every week, and optionally give it a week number to rotate it
          with other plans on the same day (Week 1 this week, Week 2 next week, and so on) — or leave Repeat off for
          a one-time plan on the next occurrence of that day.
        </p>

        <CrudLayout
          table={
            <TableShell
              head={
                <>
                  <th className="table-head">When</th>
                  <th className="table-head">Plan</th>
                  <th className="table-head">Exercises</th>
                  <th className="table-head">Status</th>
                  <th className="table-head" />
                </>
              }
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {plans.map((p) => (
                  <motion.tr
                    key={p.id}
                    variants={rowItem}
                    exit="exit"
                    layout
                    className={cx("border-b border-rule last:border-0", !p.active && "opacity-55")}
                  >
                    <td className="table-cell whitespace-nowrap">
                      {p.event_date ? (
                        <Pill tone="neutral">Once — {parseDate(p.event_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</Pill>
                      ) : p.day_of_week !== null ? (
                        (() => {
                          const group = weekdayGroup(p.day_of_week!);
                          const idx = group.findIndex((x) => x.id === p.id);
                          const rotating = group.length > 1 || p.sort_order !== 1;
                          return (
                            <span className="flex items-center gap-1">
                              <Pill tone="accent">
                                Every {dayName(p.day_of_week)}
                                {rotating && ` · Week ${p.sort_order}`}
                              </Pill>
                              {group.length > 1 && (
                                <>
                                  <IconButton
                                    type="button"
                                    onClick={() => moveWeekdayPlan(p, -1)}
                                    disabled={idx === 0}
                                    aria-label="Move earlier in rotation"
                                  >
                                    <ArrowUp size={12} />
                                  </IconButton>
                                  <IconButton
                                    type="button"
                                    onClick={() => moveWeekdayPlan(p, 1)}
                                    disabled={idx === group.length - 1}
                                    aria-label="Move later in rotation"
                                  >
                                    <ArrowDown size={12} />
                                  </IconButton>
                                </>
                              )}
                            </span>
                          );
                        })()
                      ) : (
                        <Pill tone="warn">Daily cycle #{cyclePlans.findIndex((x) => x.id === p.id) + 1}</Pill>
                      )}
                    </td>
                    <td className="table-cell font-semibold">{p.name}</td>
                    <td className="table-cell num text-muted">{p.exercises.length}</td>
                    <td className="table-cell">
                      <ActiveToggle active={p.active} onClick={() => toggle(p)} />
                    </td>
                    <td className="table-cell">
                      <div className="flex justify-end gap-1">
                        <IconButton onClick={() => startEdit(p)}>Edit</IconButton>
                        <IconButton className="hover:text-critical" onClick={() => remove(p)}>
                          Delete
                        </IconButton>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {plans.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-cell text-muted">
                    No plans yet — add one below.
                  </td>
                </tr>
              )}
            </TableShell>
          }
          formTitle={editingId ? "Edit plan" : "Add plan"}
          form={
            <form onSubmit={submit}>
              <ErrorText>{error}</ErrorText>

              <Field label="Name">
                <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Push Day" required />
              </Field>

              <Field label="When">
                <div className="grid grid-cols-7 gap-1">
                  {WEEKDAYS.map((d) => {
                    const on = selectedDays.includes(d.dow);
                    return (
                      <button
                        key={d.dow}
                        type="button"
                        onClick={() => toggleDay(d.dow)}
                        className={cx(
                          "relative rounded-lg border px-1 py-2 text-[11px] transition-colors",
                          on ? "border-accent text-ink" : "border-rule text-muted hover:text-ink"
                        )}
                      >
                        {on && (
                          <motion.span layoutId="plan-day-fill" className="absolute inset-0 rounded-lg bg-accent/12" transition={spring} />
                        )}
                        <span className="relative">{d.short}</span>
                      </button>
                    );
                  })}
                </div>

                <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} className="size-4 accent-accent" />
                  Repeat every week
                </label>

                {repeat ? (
                  <>
                    <label className="mt-2 flex cursor-pointer items-center gap-2 text-[13px]">
                      <input type="checkbox" checked={rotate} onChange={(e) => setRotate(e.target.checked)} className="size-4 accent-accent" />
                      Rotate across multiple weeks
                    </label>
                    {rotate && (
                      <div className="mt-2 flex items-center gap-2">
                        <TextInput
                          type="number"
                          min={1}
                          value={week}
                          onChange={(e) => setWeek(Math.max(1, Number(e.target.value) || 1))}
                          className="w-20"
                        />
                        <span className="text-xs text-muted">e.g. Week 1, Week 2…</span>
                      </div>
                    )}
                    {weekConflict && (
                      <p className="mt-2 text-xs text-critical">
                        Week {week} is already used by the active plan "{weekConflict.name}" on that day —
                        deactivate it first, or pick a different week.
                      </p>
                    )}
                  </>
                ) : (
                  selectedDays.length > 0 && (
                    <p className="mt-2 text-xs text-muted">
                      Happens once, on the next {selectedDays.map((d) => `${dayName(d)} (${nextOccurrence(d)})`).join(", ")}.
                    </p>
                  )
                )}
              </Field>

              <Field label="Exercises, in order">
                {list.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-rule px-3 py-4 text-center text-xs text-muted">
                    Add exercises from the list below.
                  </p>
                ) : (
                  <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                    {list.map((l, i) => (
                      <div key={l.exercise_id} className="flex items-center gap-2 rounded-lg border border-rule bg-paper px-2.5 py-2">
                        <Dot color={seriesColor(l.category_color)} />
                        <span className="flex-1 truncate text-[12.5px]">{l.name}</span>
                        <IconButton type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                          <ArrowUp size={13} />
                        </IconButton>
                        <IconButton type="button" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="Move down">
                          <ArrowDown size={13} />
                        </IconButton>
                        <IconButton type="button" onClick={() => removeExercise(l.exercise_id)} className="hover:text-critical" aria-label="Remove">
                          <X size={13} />
                        </IconButton>
                      </div>
                    ))}
                  </div>
                )}
              </Field>

              <Field label="Add an exercise">
                {exercises.length === 0 ? (
                  <p className="text-xs text-muted">No active exercises yet.</p>
                ) : (
                  <>
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {["All", ...categoryNames].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCategoryFilter(c)}
                          className={cx(
                            "cursor-pointer rounded-full border px-2.5 py-1 text-[11.5px] transition-colors",
                            categoryFilter === c ? "border-accent bg-accent/12 font-semibold text-accent" : "border-rule text-muted hover:text-ink"
                          )}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    {availableToAdd.length === 0 ? (
                      <p className="text-xs text-muted">Nothing left in this category to add.</p>
                    ) : (
                      <div className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto pr-1">
                        {availableToAdd.map((x) => (
                          <button
                            key={x.id}
                            type="button"
                            onClick={() => addExercise(x)}
                            className="flex items-center gap-1.5 rounded-full border border-rule px-2.5 py-1.5 text-[12px] text-muted transition-colors hover:border-accent hover:text-ink"
                          >
                            <Plus size={11} /> {x.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </Field>

              <div className="mt-4 flex gap-2.5">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
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
