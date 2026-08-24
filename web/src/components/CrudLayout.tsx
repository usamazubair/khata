import type { ReactNode } from "react";
import { motion } from "motion/react";
import { riseItem } from "@/lib/motion";

/** The table-plus-form shape shared by Categories, Fixed, Goals, Budgets,
 *  Exercises and Users. Each page supplies its own toolbar, rows and fields —
 *  only the arrangement lives here.
 *
 *  The column sizing is deliberate: a grid item's default `min-width: auto`
 *  lets a wide table push past its track and squeeze the form to a sliver, so
 *  the table column gets `minmax(0, …)` plus `min-w-0` (it scrolls internally
 *  instead) and the form column gets a floor it can't be pushed below. */
export function CrudLayout({
  toolbar,
  table,
  formTitle,
  form,
  footer,
}: {
  toolbar?: ReactNode;
  table: ReactNode;
  formTitle: ReactNode;
  form: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(20rem,1fr)]">
      <div className="min-w-0">
        {toolbar && <div className="mb-4 flex flex-wrap items-center gap-2.5">{toolbar}</div>}
        {table}
        {footer && <div className="mt-3 text-xs text-muted">{footer}</div>}
      </div>

      <motion.div
        variants={riseItem}
        initial="hidden"
        animate="show"
        className="surface relative min-w-0 overflow-hidden p-5 lg:sticky lg:top-20"
      >
        <span aria-hidden className="grad absolute inset-x-0 top-0 h-[3px]" />
        <h2 className="mt-1 mb-4 font-display text-lg font-bold">{formTitle}</h2>
        {form}
      </motion.div>
    </div>
  );
}
