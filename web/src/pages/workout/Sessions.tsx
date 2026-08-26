import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { del, fullDate, get, post } from "@/lib/api";
import { rowItem } from "@/lib/motion";
import { Navbar, Page } from "@/components/Shell";
import { CrudLayout } from "@/components/CrudLayout";
import {
  Button,
  ErrorText,
  Field,
  IconButton,
  PageHeader,
  Pill,
  SearchInput,
  TableShell,
  TextArea,
  TextInput,
} from "@/components/ui";
import type { WorkoutSession } from "@/lib/types";

/** The Monday of the week `d` falls in, as YYYY-MM-DD. */
function mondayOf(d: Date) {
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

function CompletionPill({ s }: { s: WorkoutSession }) {
  if (s.total_exercises === 0) return <Pill>No exercises</Pill>;
  const done = s.completed_exercises === s.total_exercises;
  return (
    <Pill tone={done ? "good" : s.completed_exercises > 0 ? "warn" : "neutral"}>
      {s.completed_exercises}/{s.total_exercises} done
    </Pill>
  );
}

export default function Sessions() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<WorkoutSession[]>([]);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [form, setForm] = useState({ name: "", occurred_on: "", notes: "" });
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (from) params.set("date_from", from);
    if (to) params.set("date_to", to);
    try {
      setRows(await get<WorkoutSession[]>(`/api/workouts/sessions?${params}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [q, from, to]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function generateThisWeek() {
    setGenerating(true);
    setError(null);
    try {
      await post("/api/workout-plans/generate", { week_start: mondayOf(new Date()) });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  // Creating a session drops you straight into adding exercises to it.
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const created = await post<WorkoutSession>("/api/workouts/sessions", {
        name: form.name.trim(),
        occurred_on: form.occurred_on || null,
        notes: form.notes.trim(),
      });
      navigate(`/workout/sessions/${created.id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(s: WorkoutSession) {
    if (!confirm(`Delete "${s.name || "Workout"}"?`)) return;
    try {
      await del(`/api/workouts/sessions/${s.id}`);
      await load();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <>
      <Navbar module="workout" />
      <Page>
        <PageHeader eyebrow="Workout" title="Sessions">
          <Button onClick={generateThisWeek} disabled={generating}>
            <span className="flex items-center gap-1.5">
              <RefreshCw size={14} className={generating ? "animate-spin" : ""} /> Generate this week
            </span>
          </Button>
        </PageHeader>

        <CrudLayout
          toolbar={
            <>
              <SearchInput value={q} onChange={setQ} placeholder="Search sessions…" />
              <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" title="From" />
              <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" title="To" />
              <button
                onClick={() => {
                  setQ("");
                  setFrom("");
                  setTo("");
                }}
                className="cursor-pointer text-xs text-muted underline hover:text-ink"
              >
                Clear
              </button>
            </>
          }
          footer={`${rows.length} session${rows.length === 1 ? "" : "s"}`}
          table={
            <TableShell
              head={
                <>
                  <th className="table-head">Date</th>
                  <th className="table-head">Session</th>
                  <th className="table-head">Progress</th>
                  <th className="table-head" />
                </>
              }
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {rows.map((s) => (
                  <motion.tr key={s.id} variants={rowItem} exit="exit" layout className="border-b border-rule last:border-0">
                    <td className="table-cell num whitespace-nowrap">{fullDate(s.occurred_on)}</td>
                    <td className="table-cell">
                      <Link to={`/workout/sessions/${s.id}`} className="hover:text-accent hover:underline">
                        {s.name || "Workout"}
                      </Link>
                    </td>
                    <td className="table-cell">
                      <CompletionPill s={s} />
                    </td>
                    <td className="table-cell">
                      <div className="flex justify-end gap-1">
                        <Link
                          to={`/workout/sessions/${s.id}`}
                          className="rounded-md px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-page2 hover:text-ink"
                        >
                          Open
                        </Link>
                        <IconButton className="hover:text-critical" onClick={() => remove(s)}>
                          Delete
                        </IconButton>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="table-cell text-muted">
                    No sessions match these filters.
                  </td>
                </tr>
              )}
            </TableShell>
          }
          formTitle="Start a session"
          form={
            <form onSubmit={submit}>
              <ErrorText>{error}</ErrorText>
              <Field label="Name">
                <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Push Day" />
              </Field>
              <Field label="Date">
                <TextInput type="date" value={form.occurred_on} onChange={(e) => setForm({ ...form, occurred_on: e.target.value })} />
              </Field>
              <Field label="Notes">
                <TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="How it went" />
              </Field>
              <Button type="submit" className="mt-2 w-full">
                Create &amp; add exercises
              </Button>
              <p className="mt-3 text-xs text-muted">
                Most weeks, "Generate this week" above does this for you from your plans — start one manually only
                for something extra.
              </p>
            </form>
          }
        />
      </Page>
    </>
  );
}
