import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { fullDate, get, money, seriesColor } from "@/lib/api";
import { rowItem } from "@/lib/motion";
import { Navbar, Page } from "@/components/Shell";
import { Dot, EmptyState, PageHeader, Pill, SearchInput, TableShell, TextInput, Modal, cx } from "@/components/ui";
import type { Category, CategoryType, Transaction } from "@/lib/types";

const TYPE_ORDER: CategoryType[] = ["expense", "fixed", "saved", "budget"];
const TYPE_LABELS: Record<CategoryType, string> = { expense: "Expense", fixed: "Fixed", saved: "Saved", budget: "Budget" };

export default function Entries() {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    get<Category[]>("/api/categories?active=true").then(setCategories).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (categoryIds.length) params.set("category_ids", categoryIds.join(","));
    if (from) params.set("date_from", from);
    if (to) params.set("date_to", to);
    try {
      setRows(await get<Transaction[]>(`/api/transactions?${params}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [q, categoryIds, from, to]);

  // Debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  function toggleCategory(id: number) {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <>
      <Navbar module="transactions" />
      <Page>
        <PageHeader eyebrow="Transactions" title="Transactions" />

        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <SearchInput value={q} onChange={setQ} placeholder="Search description or category…" />
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className={cx(
              "flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2.5 text-[13px] transition-colors",
              categoryIds.length ? "border-accent text-accent" : "border-rule text-muted hover:text-ink"
            )}
          >
            <Plus size={14} />
            {categoryIds.length ? `${categoryIds.length} categor${categoryIds.length === 1 ? "y" : "ies"}` : "Categories"}
          </button>
          <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" title="From" />
          <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" title="To" />
          <button
            onClick={() => {
              setQ("");
              setCategoryIds([]);
              setFrom("");
              setTo("");
            }}
            className="cursor-pointer text-xs text-muted underline hover:text-ink"
          >
            Clear
          </button>
        </div>

        <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Filter by category">
          <div className="mb-3 flex items-center justify-between text-xs text-muted">
            <span>{categoryIds.length ? `${categoryIds.length} selected` : "All categories"}</span>
            {categoryIds.length > 0 && (
              <button type="button" onClick={() => setCategoryIds([])} className="cursor-pointer underline hover:text-ink">
                Clear
              </button>
            )}
          </div>
          <div className="max-h-96 space-y-4 overflow-y-auto pr-1">
            {TYPE_ORDER.map((type) => {
              const inType = categories.filter((c) => c.type === type);
              if (!inType.length) return null;
              return (
                <div key={type}>
                  <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">{TYPE_LABELS[type]}</p>
                  <div className="space-y-0.5">
                    {inType.map((c) => (
                      <label
                        key={c.id}
                        className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-[13px] hover:bg-page2"
                      >
                        <input
                          type="checkbox"
                          checked={categoryIds.includes(c.id)}
                          onChange={() => toggleCategory(c.id)}
                          className="cursor-pointer accent-accent"
                        />
                        <Dot color={seriesColor(c.color)} /> {c.name}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>

        {error && <EmptyState>{error}</EmptyState>}

        <TableShell
          head={
            <>
              <th className="table-head">Date</th>
              <th className="table-head">Description</th>
              <th className="table-head">Category</th>
              <th className="table-head">Type</th>
              <th className="table-head">Amount</th>
              <th className="table-head">Paid</th>
            </>
          }
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {rows.map((t) => (
              <motion.tr key={t.id} variants={rowItem} exit="exit" layout className="border-b border-rule last:border-0">
                <td className="table-cell num whitespace-nowrap">{fullDate(t.occurred_on)}</td>
                <td className="table-cell">{t.description || "—"}</td>
                <td className="table-cell">
                  <span className="flex items-center gap-2">
                    <Dot color={seriesColor(t.category_color)} /> {t.category_name}
                  </span>
                </td>
                <td className="table-cell text-muted">{t.category_type}</td>
                <td className="table-cell num whitespace-nowrap">{money(t.amount)}</td>
                <td className="table-cell">
                  <Pill tone={t.is_paid ? "good" : "warn"}>{t.is_paid ? "Paid" : "Unpaid"}</Pill>
                </td>
              </motion.tr>
            ))}
          </AnimatePresence>
          {rows.length === 0 && !error && (
            <tr>
              <td colSpan={6} className="table-cell text-muted">
                No transactions match these filters.
              </td>
            </tr>
          )}
        </TableShell>

        <p className="mt-3 text-xs text-muted">
          {rows.length} transaction{rows.length === 1 ? "" : "s"} · add or edit them from the phone app
        </p>
      </Page>
    </>
  );
}
