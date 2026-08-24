import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "react-router-dom";
import { currentMonth, del, get, money, post, put, seriesColor } from "@/lib/api";
import { rowItem } from "@/lib/motion";
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

export default function Fixed() {
  const [rows, setRows] = useState<FixedExpense[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "", amount: "", due_day: "1", category_id: "" });
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
    setForm({ name: "", description: "", amount: "", due_day: "1", category_id: String(cats[0]?.id ?? "") });
    setError(null);
  }

  function startEdit(b: FixedExpense) {
    setEditingId(b.id);
    setForm({
      name: b.name,
      description: b.description ?? "",
      amount: String(Number(b.amount)),
      due_day: String(b.due_day),
      category_id: String(b.category_id),
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
      due_day: Number(form.due_day),
      category_id: Number(form.category_id),
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
          table={
            <TableShell
              head={
                <>
                  <th className="table-head">Name</th>
                  <th className="table-head">Category</th>
                  <th className="table-head">Due</th>
                  <th className="table-head">Amount</th>
                  <th className="table-head">Status</th>
                  <th className="table-head">Active</th>
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
                    <td className="table-cell text-muted">{b.due_day}</td>
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
              <div className="grid grid-cols-2 gap-3">
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
                <Field label="Due day">
                  <TextInput
                    type="number"
                    min="1"
                    max="31"
                    value={form.due_day}
                    onChange={(e) => setForm({ ...form, due_day: e.target.value })}
                    required
                  />
                </Field>
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
