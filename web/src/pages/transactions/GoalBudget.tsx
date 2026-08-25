import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "react-router-dom";
import { currentMonth, del, get, money, parseDate, post, put, seriesColor } from "@/lib/api";
import { rowItem } from "@/lib/motion";
import { Navbar, Page } from "@/components/Shell";
import { CrudLayout } from "@/components/CrudLayout";
import {
  ActiveField,
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
import type { Budget, Category, Goal } from "@/lib/types";

/* Goals and budgets are the same thing shaped differently: a name, a target
   price, and one category whose transactions decide what's left. Only the
   endpoint, category type, wording and the target-date field differ. */
type Kind = "goal" | "budget";

const CONFIG = {
  goal: {
    title: "Goals",
    endpoint: "/api/goals",
    categoryType: "saved",
    progressLabel: "Saved / Price",
    hasTargetDate: true,
    placeholder: "Emergency Fund",
  },
  budget: {
    title: "Budgets",
    endpoint: "/api/budgets",
    categoryType: "budget",
    progressLabel: "Spent / Price",
    hasTargetDate: false,
    placeholder: "Groceries Budget",
  },
} as const;

type Row = Goal & Budget;

export default function GoalBudget({ kind }: { kind: Kind }) {
  const cfg = CONFIG[kind];
  const [rows, setRows] = useState<Row[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: "", target_date: "", category_id: "", active: true });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const listUrl = kind === "budget" ? `${cfg.endpoint}?month=${currentMonth()}` : cfg.endpoint;
      const [list, categories] = await Promise.all([
        get<Row[]>(listUrl),
        get<Category[]>(`/api/categories?type=${cfg.categoryType}`),
      ]);
      setRows(list);
      setCats(categories);
      setForm((f) => ({ ...f, category_id: f.category_id || String(categories[0]?.id ?? "") }));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [cfg.endpoint, cfg.categoryType, kind]);

  useEffect(() => {
    load();
  }, [load]);

  function reset() {
    setEditingId(null);
    setForm({ name: "", description: "", price: "", target_date: "", category_id: String(cats[0]?.id ?? ""), active: true });
    setError(null);
  }

  function startEdit(r: Row) {
    setEditingId(r.id);
    setForm({
      name: r.name,
      description: r.description ?? "",
      price: String(Number(r.price)),
      target_date: r.target_date ? r.target_date.slice(0, 10) : "",
      category_id: String(r.category_id),
      active: r.active,
    });
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      category_id: Number(form.category_id),
      active: form.active,
    };
    if (cfg.hasTargetDate) body.target_date = form.target_date || null;
    if (!body.name || !body.category_id) return;
    try {
      if (editingId) await put(`${cfg.endpoint}/${editingId}`, body);
      else await post(cfg.endpoint, body);
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

  const filtered = rows.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <>
      <Navbar module="transactions" />
      <Page>
        <PageHeader eyebrow="Transactions" title={cfg.title} />

        <CrudLayout
          toolbar={<SearchInput value={q} onChange={setQ} placeholder={`Search ${cfg.title.toLowerCase()}…`} />}
          table={
            <TableShell
              head={
                <>
                  <th className="table-head">Name</th>
                  <th className="table-head">Category</th>
                  <th className="table-head">{cfg.progressLabel}</th>
                  <th className="table-head">Remaining</th>
                  {cfg.hasTargetDate && <th className="table-head">Target</th>}
                  <th className="table-head">Active</th>
                  <th className="table-head" />
                </>
              }
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {filtered.map((r) => {
                  const progress = Number(kind === "goal" ? r.saved : r.spent);
                  const price = Number(r.price);
                  const remaining = Number(r.remaining);
                  const pct = price > 0 ? (progress / price) * 100 : 0;
                  const tone = remaining < 0 ? "bad" : pct >= 85 ? "warn" : "good";
                  return (
                    <motion.tr
                      key={r.id}
                      variants={rowItem}
                      exit="exit"
                      layout
                      className={cx("border-b border-rule last:border-0", !r.active && "opacity-55")}
                    >
                      <td className="table-cell">{r.name}</td>
                      <td className="table-cell">
                        <span className="flex items-center gap-2">
                          <Dot color={seriesColor(r.category_color)} /> {r.category_name}
                        </span>
                      </td>
                      <td className="table-cell num whitespace-nowrap">
                        {money(progress)} / {money(price)}
                      </td>
                      <td className="table-cell">
                        {kind === "goal" ? (
                          <Pill tone={remaining <= 0 ? "good" : "neutral"}>
                            {remaining <= 0 ? "Funded" : money(remaining)}
                          </Pill>
                        ) : (
                          <Pill tone={tone}>
                            {remaining < 0 ? `${money(-remaining)} over` : money(remaining)}
                          </Pill>
                        )}
                      </td>
                      {cfg.hasTargetDate && (
                        <td className="table-cell text-muted">
                          {r.target_date
                            ? parseDate(r.target_date).toLocaleDateString(undefined, { month: "short", year: "numeric" })
                            : "—"}
                        </td>
                      )}
                      <td className="table-cell">
                        <ActiveToggle active={r.active} onClick={() => act(() => put(`${cfg.endpoint}/${r.id}`, { active: !r.active }))} />
                      </td>
                      <td className="table-cell">
                        <div className="flex justify-end gap-1">
                          <IconButton onClick={() => startEdit(r)}>Edit</IconButton>
                          <IconButton
                            className="hover:text-critical"
                            onClick={() => {
                              if (confirm(`Delete "${r.name}"?`)) act(() => del(`${cfg.endpoint}/${r.id}`));
                            }}
                          >
                            Delete
                          </IconButton>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={cfg.hasTargetDate ? 7 : 6} className="table-cell text-muted">
                    {rows.length ? "Nothing matches your search." : `No ${cfg.title.toLowerCase()} yet.`}
                  </td>
                </tr>
              )}
            </TableShell>
          }
          formTitle={editingId ? `Edit ${kind}` : `Add ${kind}`}
          form={
            <form onSubmit={submit}>
              <ErrorText>{error}</ErrorText>
              {cats.length === 0 && (
                <p className="mb-3 text-xs text-muted">
                  No “{cfg.categoryType}” categories yet —{" "}
                  <Link to="/transactions/categories" className="text-accent underline">
                    add one first
                  </Link>
                  .
                </p>
              )}

              <Field label="Name">
                <TextInput
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={cfg.placeholder}
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
              <div className={cfg.hasTargetDate ? "grid grid-cols-2 gap-3" : ""}>
                <Field label={kind === "goal" ? "Price (target)" : "Price (limit, per month)"}>
                  <TextInput
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    required
                  />
                </Field>
                {cfg.hasTargetDate && (
                  <Field label="Target date">
                    <TextInput
                      type="date"
                      value={form.target_date}
                      onChange={(e) => setForm({ ...form, target_date: e.target.value })}
                    />
                  </Field>
                )}
              </div>
              <Field label={`Category (${cfg.categoryType})`}>
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
                hint={`Inactive ${cfg.title.toLowerCase()} keep their history but disappear from the app's Insights tab.`}
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
