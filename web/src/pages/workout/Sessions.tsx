import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import { del, fullDate, get, kg, post } from "@/lib/api";
import { rowItem } from "@/lib/motion";
import { Navbar, Page } from "@/components/Shell";
import { CrudLayout } from "@/components/CrudLayout";
import {
  Button,
  ErrorText,
  Field,
  IconButton,
  PageHeader,
  SearchInput,
  TableShell,
  TextArea,
  TextInput,
} from "@/components/ui";
import type { WorkoutSession } from "@/lib/types";

export default function Sessions() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<WorkoutSession[]>([]);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [form, setForm] = useState({ name: "", occurred_on: "", notes: "" });
  const [error, setError] = useState<string | null>(null);

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

  // Creating a session drops you straight into logging sets.
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
    if (!confirm(`Delete "${s.name || "Workout"}" and every set logged in it?`)) return;
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
        <PageHeader eyebrow="Workout" title="Sessions" />

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
                  <th className="table-head">Sets</th>
                  <th className="table-head">Reps</th>
                  <th className="table-head">Volume</th>
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
                    <td className="table-cell text-muted">{s.set_count}</td>
                    <td className="table-cell text-muted">{s.total_reps}</td>
                    <td className="table-cell num whitespace-nowrap">{kg(s.volume)}</td>
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
                  <td colSpan={6} className="table-cell text-muted">
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
                Create &amp; log sets
              </Button>
            </form>
          }
        />
      </Page>
    </>
  );
}
