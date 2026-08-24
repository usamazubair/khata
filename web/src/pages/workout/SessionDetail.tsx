import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { del, get, kg, post, put } from "@/lib/api";
import { rowItem, staggerParent } from "@/lib/motion";
import { Navbar, Page } from "@/components/Shell";
import { CrudLayout } from "@/components/CrudLayout";
import {
  AnimatedNumber,
  Button,
  ErrorText,
  Field,
  IconButton,
  PageHeader,
  Select,
  StatTile,
  TableShell,
  TextArea,
  TextInput,
} from "@/components/ui";
import type { Exercise, WorkoutSession, WorkoutSet } from "@/lib/types";

export default function SessionDetail() {
  const { id } = useParams();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [editingSetId, setEditingSetId] = useState<number | null>(null);
  const [form, setForm] = useState({ exercise_id: "", reps: "", weight: "" });
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [detail, list] = await Promise.all([
        get<WorkoutSession>(`/api/workouts/sessions/${id}`),
        get<Exercise[]>("/api/exercises?active=true"),
      ]);
      setSession(detail);
      setExercises(list);
      setName(detail.name ?? "");
      setNotes(detail.notes ?? "");

      // Straight sets are the common case, so carry the last set forward.
      const last = detail.sets?.[detail.sets.length - 1];
      setForm({
        exercise_id: String(last?.exercise_id ?? list[0]?.id ?? ""),
        reps: last ? String(last.reps) : "",
        weight: last ? String(Number(last.weight)) : "",
      });
      setEditingSetId(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      await load();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const body = {
      exercise_id: Number(form.exercise_id),
      reps: Number(form.reps),
      weight: Number(form.weight || 0),
    };
    if (!body.exercise_id) return;
    try {
      if (editingSetId) await put(`/api/workouts/sets/${editingSetId}`, body);
      else await post(`/api/workouts/sessions/${id}/sets`, body);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function saveNotes() {
    try {
      await put(`/api/workouts/sessions/${id}`, { notes });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch (err) {
      alert((err as Error).message);
    }
  }

  if (error && !session) {
    return (
      <>
        <Navbar module="workout" />
        <Page>
          <p className="text-sm text-muted">{error}</p>
        </Page>
      </>
    );
  }

  return (
    <>
      <Navbar module="workout" />
      <Page>
        <PageHeader
          eyebrow={session ? new Date(session.occurred_on).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "Workout"}
          title={session?.name || "Workout"}
        >
          <Link
            to="/workout/sessions"
            className="flex items-center gap-1 rounded-lg border border-rule px-3.5 py-2 text-[13px] text-muted transition-colors hover:text-ink"
          >
            <ChevronLeft size={14} /> All sessions
          </Link>
        </PageHeader>

        {session && (
          <>
            <motion.div
              variants={staggerParent}
              initial="hidden"
              animate="show"
              className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3.5"
            >
              <StatTile label="Sets" value={<AnimatedNumber value={session.set_count} />} />
              <StatTile label="Reps" value={<AnimatedNumber value={session.total_reps} />} />
              <StatTile label="Volume" value={<AnimatedNumber value={session.volume} format={(n) => kg(n)} />} />
            </motion.div>

            <CrudLayout
              table={
                <TableShell
                  head={
                    <>
                      <th className="table-head">#</th>
                      <th className="table-head">Exercise</th>
                      <th className="table-head">Reps</th>
                      <th className="table-head">Weight</th>
                      <th className="table-head">Volume</th>
                      <th className="table-head" />
                    </>
                  }
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    {session.sets?.map((s: WorkoutSet, i) => (
                      <motion.tr key={s.id} variants={rowItem} exit="exit" layout className="border-b border-rule last:border-0">
                        <td className="table-cell font-mono text-[11px] text-muted">{i + 1}</td>
                        <td className="table-cell">{s.exercise_name}</td>
                        <td className="table-cell num">{s.reps}</td>
                        <td className="table-cell num whitespace-nowrap">{kg(s.weight)}</td>
                        <td className="table-cell num whitespace-nowrap text-muted">{kg(s.reps * Number(s.weight))}</td>
                        <td className="table-cell">
                          <div className="flex justify-end gap-1">
                            <IconButton
                              title="Log this again"
                              onClick={() =>
                                act(() =>
                                  post(`/api/workouts/sessions/${id}/sets`, {
                                    exercise_id: s.exercise_id,
                                    reps: s.reps,
                                    weight: Number(s.weight),
                                  })
                                )
                              }
                            >
                              Repeat
                            </IconButton>
                            <IconButton
                              onClick={() => {
                                setEditingSetId(s.id);
                                setForm({ exercise_id: String(s.exercise_id), reps: String(s.reps), weight: String(Number(s.weight)) });
                              }}
                            >
                              Edit
                            </IconButton>
                            <IconButton
                              className="hover:text-critical"
                              onClick={() => {
                                if (confirm("Delete this set?")) act(() => del(`/api/workouts/sets/${s.id}`));
                              }}
                            >
                              Delete
                            </IconButton>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                  {!session.sets?.length && (
                    <tr>
                      <td colSpan={6} className="table-cell text-muted">
                        No sets logged yet.
                      </td>
                    </tr>
                  )}
                </TableShell>
              }
              formTitle={editingSetId ? "Edit set" : "Log a set"}
              form={
                <form onSubmit={submit}>
                  <ErrorText>{error}</ErrorText>
                  {exercises.length === 0 ? (
                    <p className="text-xs text-muted">
                      No active exercises yet —{" "}
                      <Link to="/workout/exercises" className="text-accent underline">
                        add one first
                      </Link>
                      .
                    </p>
                  ) : (
                    <>
                      <Field label="Exercise">
                        <Select
                          value={form.exercise_id}
                          onChange={(e) => setForm({ ...form, exercise_id: e.target.value })}
                          required
                        >
                          {exercises.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Reps">
                          <TextInput
                            type="number"
                            min="0"
                            step="1"
                            value={form.reps}
                            onChange={(e) => setForm({ ...form, reps: e.target.value })}
                            required
                          />
                        </Field>
                        <Field label="Weight (kg)">
                          <TextInput
                            type="number"
                            min="0"
                            step="0.5"
                            value={form.weight}
                            onChange={(e) => setForm({ ...form, weight: e.target.value })}
                          />
                        </Field>
                      </div>
                      <div className="mt-2 flex gap-2.5">
                        <Button type="submit">{editingSetId ? "Save changes" : "Add set"}</Button>
                        {editingSetId && (
                          <Button type="button" variant="ghost" onClick={() => load()}>
                            Cancel edit
                          </Button>
                        )}
                      </div>
                      <p className="mt-3.5 text-xs text-muted">
                        The last set's exercise, reps and weight carry over, so straight sets are one click each.
                      </p>
                    </>
                  )}
                </form>
              }
            />

            <div className="surface mt-6 p-5">
              <div className="mb-2.5 flex items-center gap-3">
                <span className="font-mono text-[10px] tracking-[0.06em] text-muted uppercase">Session</span>
              </div>
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => name !== session.name && act(() => put(`/api/workouts/sessions/${id}`, { name }))}
                placeholder="Name this workout"
                className="mb-3"
              />
              <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did it go?" />
              <div className="mt-3 flex items-center gap-3">
                <Button variant="ghost" onClick={saveNotes} type="button">
                  Save notes
                </Button>
                <AnimatePresence>
                  {notesSaved && (
                    <motion.span
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-xs text-good"
                    >
                      Saved.
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </>
        )}
      </Page>
    </>
  );
}
