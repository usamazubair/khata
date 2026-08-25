import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { currentMonth, get, money, monthLabel, seriesColor, shiftMonth } from "@/lib/api";
import { ease, riseItem, staggerParent } from "@/lib/motion";
import { Navbar, Page } from "@/components/Shell";
import {
  AnimatedNumber,
  BarRow,
  Card,
  Dot,
  EmptyState,
  IconButton,
  PageHeader,
  ProgressBar,
  Pill,
  SectionLabel,
  StatTile,
} from "@/components/ui";
import type { Summary } from "@/lib/types";

export default function TransactionsOverview() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (m: string) => {
    try {
      setData(await get<Summary>(`/api/summary?month=${m}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load(month);
  }, [load, month]);

  const maxCat = data?.by_category.length ? Math.max(...data.by_category.map((c) => c.total)) : 1;

  return (
    <>
      <Navbar module="transactions" />
      <Page>
        <PageHeader eyebrow="Transactions" title="Overview">
          <div className="flex items-center gap-2 rounded-full border border-rule bg-page px-1.5 py-1">
            <IconButton onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month">
              <ChevronLeft size={16} />
            </IconButton>
            {/* The label swaps with a slide so the direction of travel reads. */}
            <span className="relative w-32 overflow-hidden text-center text-[13px]">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={month}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease }}
                  className="block"
                >
                  {monthLabel(month)}
                </motion.span>
              </AnimatePresence>
            </span>
            <IconButton onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Next month">
              <ChevronRight size={16} />
            </IconButton>
          </div>
        </PageHeader>

        {error && <EmptyState>{error}</EmptyState>}

        {data && (
          <motion.div variants={staggerParent} initial="hidden" animate="show" key={month}>
            <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-3.5">
              <StatTile
                label="Spent this month"
                value={<AnimatedNumber value={data.total_expense} format={(n) => money(n)} />}
              />
              <StatTile
                label="Total saved"
                accent="good"
                value={<AnimatedNumber value={data.total_saved} format={(n) => money(n)} />}
              />
              <StatTile label="Categories" value={<AnimatedNumber value={data.total_categories} />} />
              <StatTile label="Transactions" value={<AnimatedNumber value={data.total_transactions} />} />
            </div>

            <div className="grid gap-4.5 md:grid-cols-2">
              <Card>
                <SectionLabel>Spent by category</SectionLabel>
                {data.by_category.length === 0 ? (
                  <EmptyState>No spending yet this month.</EmptyState>
                ) : (
                  <motion.div variants={staggerParent} className="mt-3 flex flex-col gap-2.5">
                    {data.by_category.map((c) => (
                      <BarRow
                        key={c.category_id}
                        name={c.name}
                        dot={seriesColor(c.color)}
                        color={seriesColor(c.color)}
                        pct={(c.total / maxCat) * 100}
                        value={money(c.total)}
                      />
                    ))}
                  </motion.div>
                )}
              </Card>

              <Card>
                <SectionLabel>Recent transactions</SectionLabel>
                {data.recent.length === 0 ? (
                  <EmptyState>No transactions yet.</EmptyState>
                ) : (
                  <motion.div variants={staggerParent} className="mt-1">
                    {data.recent.map((t, i) => (
                      <motion.div
                        key={t.id}
                        variants={riseItem}
                        className={`flex items-center gap-2.5 py-2.5 text-[13px] ${
                          i === data.recent.length - 1 ? "" : "border-b border-rule"
                        }`}
                      >
                        <Dot color={seriesColor(t.category_color)} size={8} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate">{t.description || t.category_name}</div>
                          <div className="text-[11px] text-muted">
                            {t.category_name}
                            {!t.is_paid && " · Unpaid"}
                          </div>
                        </div>
                        <span className="num">{money(t.amount)}</span>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </Card>
            </div>

            <SectionLabel>
              <div className="mt-7">Budgets — what's left</div>
            </SectionLabel>
            {data.budgets.length === 0 ? (
              <EmptyState>No budgets yet.</EmptyState>
            ) : (
              <motion.div variants={staggerParent} className="grid gap-2.5">
                {data.budgets.map((b) => {
                  const price = Number(b.price);
                  const spent = Number(b.spent);
                  const remaining = Number(b.remaining);
                  const pct = price > 0 ? (spent / price) * 100 : 0;
                  const tone = remaining < 0 ? "bad" : pct >= 85 ? "warn" : "good";
                  const color =
                    remaining < 0 ? "var(--critical)" : pct >= 85 ? "var(--warning)" : "var(--accent-2)";
                  return (
                    <motion.div key={b.id} variants={riseItem} layout className="surface px-4 py-3.5">
                      <div className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="flex items-center gap-2 font-semibold">
                          <Dot color={seriesColor(b.category_color)} /> {b.name}
                        </span>
                        <span className="num text-xs text-muted">
                          {money(spent)} / {money(price)}
                        </span>
                      </div>
                      <div className="mt-2.5">
                        <ProgressBar pct={pct} color={color} />
                      </div>
                      <div className="mt-2 flex justify-between text-[11px] text-muted">
                        <span>{b.category_name}</span>
                        <Pill tone={tone}>
                          {remaining < 0 ? `${money(-remaining)} over` : `${money(remaining)} left`}
                        </Pill>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            <SectionLabel>
              <div className="mt-7">Goals — what's left</div>
            </SectionLabel>
            {data.goals.length === 0 ? (
              <EmptyState>No goals yet.</EmptyState>
            ) : (
              <motion.div variants={staggerParent} className="grid gap-2.5">
                {data.goals.map((g) => {
                  const price = Number(g.price);
                  const saved = Number(g.saved);
                  const remaining = Number(g.remaining);
                  const pct = price > 0 ? (saved / price) * 100 : 0;
                  return (
                    <motion.div key={g.id} variants={riseItem} layout className="surface px-4 py-3.5">
                      <div className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="flex items-center gap-2 font-semibold">
                          <Dot color={seriesColor(g.category_color)} /> {g.name}
                        </span>
                        <span className="num text-xs text-muted">
                          {money(saved)} / {money(price)}
                        </span>
                      </div>
                      <div className="mt-2.5">
                        <ProgressBar pct={pct} />
                      </div>
                      <div className="mt-2 flex justify-between text-[11px] text-muted">
                        <span>
                          {g.target_date
                            ? `Target: ${monthLabel(g.target_date.slice(0, 7))}`
                            : g.category_name}
                        </span>
                        <Pill tone={remaining <= 0 ? "good" : "neutral"}>
                          {remaining <= 0 ? "Funded" : `${money(remaining)} left`}
                        </Pill>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            <SectionLabel>
              <div className="mt-7">Fixed transactions — what's left</div>
            </SectionLabel>
            {data.fixed_total === 0 ? (
              <EmptyState>No fixed transactions yet.</EmptyState>
            ) : (
              <motion.div variants={riseItem} layout className="surface px-4 py-3.5">
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="font-semibold">This month</span>
                  <span className="num text-xs text-muted">
                    {money(data.fixed_total - data.fixed_remaining)} / {money(data.fixed_total)}
                  </span>
                </div>
                <div className="mt-2.5">
                  <ProgressBar
                    pct={data.fixed_total > 0 ? ((data.fixed_total - data.fixed_remaining) / data.fixed_total) * 100 : 0}
                  />
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-muted">
                  <span>Total / paid so far</span>
                  <Pill tone={data.fixed_remaining <= 0 ? "good" : "neutral"}>
                    {data.fixed_remaining <= 0 ? "All paid" : `${money(data.fixed_remaining)} left`}
                  </Pill>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </Page>
    </>
  );
}
