import type { ReactNode } from "react";
import { motion } from "motion/react";
import { riseItem } from "@/lib/motion";

/** The table-plus-form shape shared by Categories, Fixed, Goals, Budgets,
 *  Exercises and Users. Each page supplies its own toolbar, rows and fields —
 *  only the arrangement lives here. */
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
    <div className="grid items-start gap-6 lg:grid-cols-[1.45fr_1fr]">
      <div>
        {toolbar && <div className="mb-4 flex flex-wrap items-center gap-2.5">{toolbar}</div>}
        {table}
        {footer && <div className="mt-3 text-xs text-muted">{footer}</div>}
      </div>

      <motion.div
        variants={riseItem}
        initial="hidden"
        animate="show"
        className="rounded-2xl border border-rule bg-page p-5 lg:sticky lg:top-20"
      >
        <h2 className="mb-4 font-display text-lg">{formTitle}</h2>
        {form}
      </motion.div>
    </div>
  );
}
