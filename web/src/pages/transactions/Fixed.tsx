import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "react-router-dom";
import { BellRing } from "lucide-react";
import { currentMonth, del, get, money, post, put, seriesColor } from "@/lib/api";
import { rowItem } from "@/lib/motion";
import { Navbar, Page } from "@/components/Shell";
import { CrudLayout } from "@/components/CrudLayout";
import {
  ActiveField,
  ActiveToggle,
  Button,
  DayPicker,
  Dot,
  ErrorText,
  Field,
  IconButton,
  PageHeader,
  Pill,
  SearchInput,
  Select,
  TableShell,
  TextArea,
  TextInput,
  cx,
} from "@/components/ui";
import type { Category, FixedExpense } from "@/lib/types";

const STATUS = {
  paid: { label: "Paid", tone: "good" },
  due: { label: "Due", tone: "warn" },
  unlogged: { label: "Not logged", tone: "neutral" },
} as const;

function ordinal(n: number) {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return n + (["th", "st", "nd", "rd"][n % 10] ?? "th");
}

export default function Fixed() {
  const [rows, setRows] = useState<FixedExpense[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "", amount: "", due_day: 1, category_id: "", active: true });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [bills, categories] = await Promise.all([
        get<FixedExpense[]>(`/api/fixed-expenses?month=${currentMonth()}`),
        get<Category[]>("/api/categories?type=fixed"),
      ]);
      setRows(bills);
      setCats(categories);
      setForm((f) => ({ ...f, category_id: f.category_id || String(categories[0]?.id ?? "") }));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function reset() {
    setEditingId(null);
    setForm({ name: "", description: "", amount: "", due_day: 1, category_id: String(cats[0]?.id ?? ""), active: true });
    setError(null);
  }

  function startEdit(b: FixedExpense) {
    setEditingId(b.id);
    setForm({
      name: b.name,
      description: b.description ?? "",
      amount: String(Number(b.amount)),
      due_day: b.due_day,
      category_id: String(b.category_id),
      active: b.active,
    });
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const body = {
      name: form.name.trim(),
      description: form.description.trim(),
      amount: Number(form.amount),
      due_day: form.due_day,
      category_id: Number(form.category_id),
      active: form.active,
    };
    if (!body.name || !body.category_id) return;
    try {
      if (editingId) await put(`/api/fixed-expenses/${editingId}`, body);
      else await post("/api/fixed-expenses", body);
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

  const filtered = rows.filter((b) =>
    `${b.name} ${b.description}`.toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <>
      <Navbar module="transactions" />
      <Page>
        <PageHeader eyebrow="Transactions" title="Fixed Transactions" />

        <CrudLayout
          toolbar={<SearchInput value={q} onChange={setQ} placeholder="Search fixed transactions…" />}
          footer="Every bill repeats on the same day each month. The app reminds you the day before, and again on the day itself until you log it."
          table={
            <TableShell
              head={
                <>
                  <th className="table-head">Name</th>
                  <th className="table-head">Category</th>
                  <th className="table-head">Repeats</th>
                  <th className="table-head">Amount</th>
                  <th className="table-head">This month</th>
                  <th className="table-head">Status</th>
                  <th className="table-head" />
                </>
              }
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {filtered.map((b) => (
                  <motion.tr
                    key={b.id}
                    variants={rowItem}
                    exit="exit"
                    layout
                    className={cx("border-b border-rule last:border-0", !b.active && "opacity-55")}
                  >
                    <td className="table-cell">{b.name}</td>
                    <td className="table-cell">
                      <span className="flex items-center gap-2">
                        <Dot color={seriesColor(b.category_color)} /> {b.category_name}
                      </span>
                    </td>
                    <td className="table-cell whitespace-nowrap text-muted">{ordinal(b.due_day)} monthly</td>
                    <td className="table-cell num whitespace-nowrap">{money(b.amount)}</td>
                    <td className="table-cell">
                      <Pill tone={STATUS[b.status].tone}>{STATUS[b.status].label}</Pill>
                    </td>
                    <td className="table-cell">
                      <ActiveToggle active={b.active} onClick={() => act(() => put(`/api/fixed-expenses/${b.id}`, { active: !b.active }))} />
                    </td>
                    <td className="table-cell">
                      <div className="flex justify-end gap-1">
                        {b.status !== "paid" && b.active && (
                          <IconButton onClick={() => act(() => post(`/api/fixed-expenses/${b.id}/confirm`, {}))}>
                            Log it
                          </IconButton>
                        )}
                        <IconButton onClick={() => startEdit(b)}>Edit</IconButton>
                        <IconButton
                          className="hover:text-critical"
                          onClick={() => {
                            if (confirm(`Delete "${b.name}"?`)) act(() => del(`/api/fixed-expenses/${b.id}`));
                          }}
                        >
                          Delete
                        </IconButton>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="table-cell text-muted">
                    {rows.length ? "Nothing matches your search." : "No fixed transactions yet."}
                  </td>
                </tr>
              )}
            </TableShell>
          }
          formTitle={editingId ? "Edit fixed transaction" : "Add fixed transaction"}
          form={
            <form onSubmit={submit}>
              <ErrorText>{error}</ErrorText>
              {cats.length === 0 && (
                <p className="mb-3 text-xs text-muted">
                  No “fixed” categories yet — <Link to="/transactions/categories" className="text-accent underline">add one first</Link>.
                </p>
              )}

              <Field label="Name">
                <TextInput
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Rent"
                  required
                />
              </Field>
              <Field label="Description">
                <TextArea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional note"
                />
              </Field>
              <Field label="Amount">
                <TextInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </Field>

              <Field label={`Due date — repeats the ${ordinal(form.due_day)} of every month`}>
                <DayPicker value={form.due_day} onChange={(d) => setForm({ ...form, due_day: d })} />
              </Field>

              <div className="mb-3.5 flex gap-2.5 rounded-lg border border-accent/35 bg-accent/8 px-3 py-2.5 text-[11.5px] text-muted">
                <BellRing size={15} className="mt-px shrink-0 text-accent" />
                <span>
                  You'll be nudged on the <strong className="text-ink">{ordinal(Math.max(1, form.due_day - 1))}</strong>{" "}
                  ({form.due_day === 1 ? "the last day of the previous month" : "a day early"}) and again on the{" "}
                  <strong className="text-ink">{ordinal(form.due_day)}</strong> if it still isn't logged. Turn the
                  reminders on and pick the time in the app's Settings.
                </span>
              </div>

              <Field label="Category (fixed)">
                <Select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} required>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <ActiveField
                active={form.active}
                onChange={(v) => setForm({ ...form, active: v })}
                hint="Inactive bills stop reminding you and stop reaching the mobile app, but keep their history."
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
