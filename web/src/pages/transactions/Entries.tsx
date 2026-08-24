import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { fullDate, get, money, seriesColor } from "@/lib/api";
import { rowItem } from "@/lib/motion";
import { Navbar, Page } from "@/components/Shell";
import { Dot, EmptyState, PageHeader, Pill, SearchInput, TableShell, TextInput, Select } from "@/components/ui";
import type { Transaction } from "@/lib/types";

const TYPES = ["", "expense", "fixed", "saved", "budget"];

export default function Entries() {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (type) params.set("category_type", type);
    if (from) params.set("date_from", from);
    if (to) params.set("date_to", to);
    try {
      setRows(await get<Transaction[]>(`/api/transactions?${params}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [q, type, from, to]);

  // Debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <>
      <Navbar module="transactions" />
      <Page>
        <PageHeader eyebrow="Transactions" title="Transactions" />

        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <SearchInput value={q} onChange={setQ} placeholder="Search description or category…" />
          <Select value={type} onChange={(e) => setType(e.target.value)} className="w-auto">
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t ? t[0].toUpperCase() + t.slice(1) : "All types"}
              </option>
            ))}
          </Select>
          <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" title="From" />
          <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" title="To" />
          <button
            onClick={() => {
              setQ("");
              setType("");
              setFrom("");
              setTo("");
            }}
            className="cursor-pointer text-xs text-muted underline hover:text-ink"
          >
            Clear
          </button>
        </div>

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
