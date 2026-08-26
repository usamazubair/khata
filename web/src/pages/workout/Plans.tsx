import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { del, get, parseDate, post, put, seriesColor } from "@/lib/api";
import { rowItem, spring } from "@/lib/motion";
import { WEEKDAYS } from "@/lib/timetable";
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
const today = () => new Date().toISOString().slice(0, 10);

export default function Plans() {
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [repeats, setRepeats] = useState(true);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [eventDate, setEventDate] = useState(today);
  const [list, setList] = useState<PlanExercise[]>([]);
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
    setRepeats(true);
    setDayOfWeek(1);
    setEventDate(today());
    setList([]);
    setError(null);
  }

  function startEdit(p: WorkoutPlan) {
    setEditingId(p.id);
    setName(p.name);
    setRepeats(!p.event_date);
    setDayOfWeek(p.day_of_week);
    setEventDate(p.event_date ?? today());
    setList(p.exercises.map((e) => ({ exercise_id: e.exercise_id, name: e.name, category_name: e.category_name, category_color: e.category_color })));
    setError(null);
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
    setSaving(true);
    setError(null);
    try {
      const body = { name: name.trim(), day_of_week: dayOfWeek, event_date: repeats ? null : eventDate };
      const planId = editingId ?? (await post<WorkoutPlan>("/api/workout-plans", body)).id;
      if (editingId) await put(`/api/workout-plans/${editingId}`, body);
      await put(`/api/workout-plans/${planId}/exercises`, { exercise_ids: list.map((l) => l.exercise_id) });
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

  const availableToAdd = exercises.filter((x) => !list.some((l) => l.exercise_id === x.id));

  return (
    <>
      <Navbar module="workout" />
      <Page>
        <PageHeader eyebrow="Workout" title="Plans" />
        <p className="mb-4 text-xs text-muted">
          A plan is a weekly split — pick a weekday and its fixed exercise list. "Generate this week" on Sessions
          turns each active plan into a real, dated session, ready to tick off.
        </p>

        <CrudLayout
          table={
            <TableShell
              head={
                <>
                  <th className="table-head">Weekday</th>
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
                        <Pill tone="neutral">{parseDate(p.event_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</Pill>
                      ) : (
                        <Pill tone="accent">Every {dayName(p.day_of_week)}</Pill>
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
                    No plans yet — set up your weekly split below.
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
                <div className="mb-2.5 flex gap-1 rounded-xl bg-page2 p-1">
                  {[
                    { on: true, label: "Every week" },
                    { on: false, label: "Just once" },
                  ].map((o) => (
                    <button
                      key={String(o.on)}
                      type="button"
                      onClick={() => setRepeats(o.on)}
                      className="relative flex-1 cursor-pointer rounded-lg px-3 py-1.5 text-xs"
                    >
                      {repeats === o.on && (
                        <motion.span layoutId="plan-repeat-mode" className="absolute inset-0 rounded-lg bg-page shadow-sm" transition={spring} />
                      )}
                      <span className={cx("relative", repeats === o.on ? "font-semibold text-ink" : "text-muted")}>{o.label}</span>
                    </button>
                  ))}
                </div>

                {repeats ? (
                  <div className="grid grid-cols-7 gap-1">
                    {WEEKDAYS.map((d) => {
                      const on = d.dow === dayOfWeek;
                      // A weekday already spoken for by another *repeating* plan reads as
                      // "in use" — one-off plans don't block a weekday from repeating use.
                      const takenByOther = plans.some((p) => p.day_of_week === d.dow && p.id !== editingId && !p.event_date);
                      return (
                        <button
                          key={d.dow}
                          type="button"
                          onClick={() => setDayOfWeek(d.dow)}
                          title={takenByOther ? "Already has a plan" : undefined}
                          className={cx(
                            "relative rounded-lg border px-1 py-2 text-[11px] transition-colors",
                            on ? "border-accent text-ink" : "border-rule text-muted hover:text-ink",
                            takenByOther && !on && "opacity-50"
                          )}
                        >
                          {on && (
                            <motion.span layoutId="plan-day" className="absolute inset-0 rounded-lg bg-accent/12" transition={spring} />
                          )}
                          <span className="relative">{d.short}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <TextInput type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
                )}
              </Field>

              <Field label="Exercises, in order">
                {list.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-rule px-3 py-4 text-center text-xs text-muted">
                    Add exercises from the list below.
                  </p>
                ) : (
                  <div className="space-y-1.5">
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
                {availableToAdd.length === 0 ? (
                  <p className="text-xs text-muted">
                    {exercises.length === 0 ? "No active exercises yet." : "Every active exercise is already on this plan."}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
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
