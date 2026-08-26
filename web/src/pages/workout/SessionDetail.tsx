import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link, useParams } from "react-router-dom";
import { Check, ChevronLeft } from "lucide-react";
import { del, get, parseDate, post, put, seriesColor } from "@/lib/api";
import { rowItem, spring, staggerParent } from "@/lib/motion";
import { Navbar, Page } from "@/components/Shell";
import { CrudLayout } from "@/components/CrudLayout";
import {
  AnimatedNumber,
  Button,
  Dot,
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
import type { Exercise, WorkoutSession } from "@/lib/types";

export default function SessionDetail() {
  const { id } = useParams();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [addingId, setAddingId] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

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

  async function addExercise(e: React.FormEvent) {
    e.preventDefault();
    if (!addingId) return;
    setError(null);
    try {
      await post(`/api/workouts/sessions/${id}/exercises`, { exercise_id: Number(addingId) });
      setAddingId("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggleComplete(seId: number, completed: boolean) {
    setBusyId(seId);
    try {
      await put(`/api/workouts/session-exercises/${seId}`, { completed });
      await load();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function saveNotes(seId: number, value: string) {
    try {
      await put(`/api/workouts/session-exercises/${seId}`, { notes: value });
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function saveNotesField() {
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

  const availableToAdd = exercises.filter((x) => !session?.exercises?.some((se) => se.exercise_id === x.id));

  return (
    <>
      <Navbar module="workout" />
      <Page>
        <PageHeader
          eyebrow={
            session
              ? parseDate(session.occurred_on).toLocaleDateString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "Workout"
          }
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
              <StatTile label="Exercises" value={<AnimatedNumber value={session.total_exercises} />} />
              <StatTile
                label="Completed"
                accent={session.total_exercises > 0 && session.completed_exercises === session.total_exercises ? "good" : undefined}
                value={<AnimatedNumber value={session.completed_exercises} />}
              />
            </motion.div>

            <CrudLayout
              table={
                <TableShell
                  head={
                    <>
                      <th className="table-head" />
                      <th className="table-head">Exercise</th>
                      <th className="table-head">Notes</th>
                      <th className="table-head" />
                    </>
                  }
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    {session.exercises?.map((se) => (
                      <motion.tr key={se.id} variants={rowItem} exit="exit" layout className="border-b border-rule last:border-0">
                        <td className="table-cell">
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.85 }}
                            transition={spring}
                            disabled={busyId === se.id}
                            onClick={() => toggleComplete(se.id, !se.completed)}
                            className={`flex size-[22px] cursor-pointer items-center justify-center rounded-md border-2 transition-colors ${
                              se.completed ? "border-good bg-good text-white" : "border-rule hover:border-good"
                            }`}
                          >
                            {se.completed && <Check size={13} strokeWidth={3} />}
                          </motion.button>
                        </td>
                        <td className="table-cell">
                          <span className={`flex items-center gap-2 ${se.completed ? "text-muted line-through" : ""}`}>
                            <Dot color={seriesColor(se.category_color)} /> {se.exercise_name}
                          </span>
                        </td>
                        <td className="table-cell">
                          <input
                            defaultValue={se.notes}
                            onBlur={(e) => e.target.value !== se.notes && saveNotes(se.id, e.target.value)}
                            placeholder="How did it feel?"
                            className="w-full min-w-32 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[12.5px] outline-none transition-colors placeholder:text-muted/60 hover:border-rule focus:border-accent focus:bg-paper"
                          />
                        </td>
                        <td className="table-cell">
                          <div className="flex justify-end">
                            <IconButton
                              className="hover:text-critical"
                              onClick={() => {
                                if (confirm(`Remove "${se.exercise_name}" from this session?`))
                                  act(() => del(`/api/workouts/session-exercises/${se.id}`));
                              }}
                            >
                              Remove
                            </IconButton>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                  {!session.exercises?.length && (
                    <tr>
                      <td colSpan={4} className="table-cell text-muted">
                        No exercises on this session yet.
                      </td>
                    </tr>
                  )}
                </TableShell>
              }
              formTitle="Add an exercise"
              form={
                <form onSubmit={addExercise}>
                  <ErrorText>{error}</ErrorText>
                  {exercises.length === 0 ? (
                    <p className="text-xs text-muted">
                      No active exercises yet —{" "}
                      <Link to="/workout/exercises" className="text-accent underline">
                        add one first
                      </Link>
                      .
                    </p>
                  ) : availableToAdd.length === 0 ? (
                    <p className="text-xs text-muted">Every active exercise is already on this session.</p>
                  ) : (
                    <>
                      <Field label="Exercise">
                        <Select value={addingId} onChange={(e) => setAddingId(e.target.value)} required>
                          <option value="" disabled>
                            Choose one…
                          </option>
                          {availableToAdd.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Button type="submit" className="mt-2 w-full">
                        Add to session
                      </Button>
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
              <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did it go overall?" />
              <div className="mt-3 flex items-center gap-3">
                <Button variant="ghost" onClick={saveNotesField} type="button">
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
