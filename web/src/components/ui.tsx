import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect, useId, type ReactNode } from "react";
import { X } from "lucide-react";
import { backdropVariants, ease, panelVariants, riseItem, spring, staggerParent, tapScale } from "@/lib/motion";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

/* ── layout primitives ─────────────────────────────────────────────────── */

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && (
          <p className="mb-2 flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.12em] text-muted uppercase">
            <span className="grad h-3 w-1 rounded-full" />
            {eyebrow}
          </p>
        )}
        <h1 className="grad-text font-display text-[34px] leading-[1.1] font-extrabold">{title}</h1>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  );
}

export function Card({ className, children, ...rest }: React.ComponentProps<typeof motion.div>) {
  return (
    <motion.div variants={riseItem} className={cx("surface p-5", className)} {...rest}>
      {children}
    </motion.div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2.5 font-mono text-[10px] tracking-[0.08em] text-muted uppercase">{children}</div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-2 text-sm text-muted">{children}</p>;
}

/* ── numbers that animate to their value ───────────────────────────────── */

export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toLocaleString(),
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const springed = useSpring(mv, { stiffness: 90, damping: 20, mass: 0.6 });
  const text = useTransform(springed, (n) => format(n));

  useEffect(() => {
    mv.set(value);
  }, [mv, value]);

  if (reduce) return <span className={className}>{format(value)}</span>;
  return <motion.span className={className}>{text}</motion.span>;
}

export function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: "good" | "critical";
}) {
  // A coloured hairline along the top ties each tile to what it reports.
  const bar =
    accent === "good"
      ? "bg-good"
      : accent === "critical"
        ? "bg-critical"
        : "grad";

  return (
    <motion.div variants={riseItem} className="surface relative overflow-hidden px-4 py-3.5">
      <span aria-hidden className={cx("absolute inset-x-0 top-0 h-[3px]", bar)} />
      <div className="mt-1 font-mono text-[10px] tracking-[0.08em] text-muted uppercase">{label}</div>
      <div
        className={cx(
          "num mt-1 text-[23px] font-semibold",
          accent === "good" && "text-good",
          accent === "critical" && "text-critical"
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </motion.div>
  );
}

/* ── bars ──────────────────────────────────────────────────────────────── */

export function ProgressBar({ pct, color }: { pct: number; color?: string }) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-page2">
      <motion.div
        className={cx("h-full rounded-full", !color && "grad")}
        style={color ? { backgroundColor: color } : undefined}
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.7, ease }}
      />
    </div>
  );
}

export function BarRow({
  name,
  value,
  pct,
  color,
  dot,
}: {
  name: string;
  value: string;
  pct: number;
  color?: string;
  dot?: string;
}) {
  return (
    <motion.div variants={riseItem} className="flex items-center gap-2.5 text-[13px]">
      {dot && <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: dot }} />}
      <span className="w-24 shrink-0 truncate">{name}</span>
      <div className="flex-1">
        <ProgressBar pct={pct} color={color} />
      </div>
      <span className="num w-20 shrink-0 text-right text-xs text-muted">{value}</span>
    </motion.div>
  );
}

/* ── controls ──────────────────────────────────────────────────────────── */

export function Button({
  variant = "primary",
  className,
  children,
  ...rest
}: React.ComponentProps<typeof motion.button> & { variant?: "primary" | "ghost" | "danger" }) {
  const styles = {
    primary: "grad text-white shadow-[0_6px_20px_-8px_rgb(var(--glow)/0.9)] hover:brightness-110",
    ghost: "border border-rule text-muted hover:text-ink hover:border-accent/60 hover:bg-page2",
    danger: "border border-critical/60 text-critical hover:bg-critical/10",
  }[variant];

  return (
    <motion.button
      whileTap={tapScale}
      transition={spring}
      className={cx(
        "cursor-pointer rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-[filter,background-color,border-color,color] disabled:cursor-default disabled:opacity-60",
        styles,
        className
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

export function IconButton({
  className,
  children,
  ...rest
}: React.ComponentProps<typeof motion.button>) {
  return (
    <motion.button
      whileTap={tapScale}
      className={cx(
        "cursor-pointer rounded-md px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-page2 hover:text-ink disabled:opacity-40",
        className
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "good" | "warn" | "bad" | "accent";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-page2 text-muted",
    good: "bg-good/15 text-good",
    warn: "bg-warning/20 text-warning",
    bad: "bg-critical/15 text-critical",
    accent: "bg-accent/15 text-accent",
  }[tone];
  return (
    <span className={cx("inline-flex rounded-full px-2.5 py-1 font-mono text-[10.5px] whitespace-nowrap", tones)}>
      {children}
    </span>
  );
}

/** Active/inactive switch — the soft alternative to deleting. Drawn as a real
 *  track-and-knob so it reads as a control, not as a status badge. */
export function ActiveToggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={tapScale}
      role="switch"
      aria-checked={active}
      title={active ? "Active — click to deactivate" : "Inactive — click to activate"}
      className="flex cursor-pointer items-center gap-2"
    >
      <span
        className={cx(
          "flex h-[19px] w-[34px] shrink-0 items-center rounded-full p-0.5 transition-colors",
          active ? "grad" : "bg-rule"
        )}
      >
        <motion.span
          layout
          transition={spring}
          className={cx("size-[15px] rounded-full bg-white shadow-sm", active ? "ml-auto" : "mr-auto")}
        />
      </span>
      {label !== false && (
        <span className={cx("font-mono text-[10.5px] whitespace-nowrap", active ? "text-ink" : "text-muted")}>
          {active ? "Active" : "Inactive"}
        </span>
      )}
    </motion.button>
  );
}

/** The same switch as a labelled form row, so status is editable while you're
 *  filling in the rest of the record — not only from the table. */
export function ActiveField({
  active,
  onChange,
  hint = "Inactive records keep their history but stop showing up in the mobile app.",
}: {
  active: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="mb-3.5 rounded-lg border border-rule bg-paper px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium">Status</span>
        <ActiveToggle active={active} onClick={() => onChange(!active)} />
      </div>
      <p className="mt-1.5 text-[11.5px] text-muted">{hint}</p>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="mb-3.5">
      <label className="field-label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function TextInput(props: React.ComponentProps<"input">) {
  return <input {...props} className={cx("field-input", props.className)} />;
}

export function TextArea(props: React.ComponentProps<"textarea">) {
  return <textarea {...props} className={cx("field-input min-h-[72px] resize-y", props.className)} />;
}

export function Select(props: React.ComponentProps<"select">) {
  return <select {...props} className={cx("field-input cursor-pointer", props.className)} />;
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="min-w-44 flex-1 rounded-full border border-rule bg-page px-4 py-2.5 text-[13px] outline-none transition-colors placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/25"
    />
  );
}

/** Row of filter chips with a shared-layout highlight that slides between
 *  them. Counts sit inside each chip so an empty filter is obvious before
 *  you click it. */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cx(
              "relative cursor-pointer rounded-full border px-3.5 py-2 text-[12.5px] transition-colors",
              on ? "border-transparent" : "border-rule text-muted hover:border-accent/50 hover:text-ink"
            )}
          >
            {on && (
              <motion.span
                layoutId={`chip-${id}`}
                className="grad absolute inset-0 rounded-full shadow-[0_6px_18px_-10px_rgb(var(--glow)/0.9)]"
                transition={spring}
              />
            )}
            <span className={cx("relative flex items-center gap-1.5", on && "font-semibold text-white")}>
              {o.label}
              {o.count !== undefined && (
                <span className={cx("num text-[10.5px]", on ? "text-white/75" : "text-muted")}>{o.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Segmented control with a shared-layout pill that slides between options. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="flex gap-1 rounded-xl bg-page2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className="relative flex-1 cursor-pointer rounded-lg px-3 py-1.5 text-xs transition-colors"
        >
          {value === o.value && (
            <motion.span
              layoutId={`seg-${id}`}
              className="absolute inset-0 rounded-lg bg-page shadow-sm"
              transition={spring}
            />
          )}
          <span className={cx("relative", value === o.value ? "font-semibold text-ink" : "text-muted")}>
            {o.label}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Month-day picker: a 1–31 calendar grid for a date that repeats every
 *  month, so there's no year to choose. Days past 28 are marked because short
 *  months fall back to their last day. */
export function DayPicker({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 rounded-xl border border-rule bg-paper p-2">
        {days.map((d) => {
          const on = d === value;
          return (
            <motion.button
              key={d}
              type="button"
              whileTap={{ scale: 0.9 }}
              transition={spring}
              onClick={() => onChange(d)}
              className={cx(
                "num relative aspect-square cursor-pointer rounded-md text-[12px] transition-colors",
                on ? "text-white" : d > 28 ? "text-muted/70 hover:bg-page2" : "text-ink hover:bg-page2"
              )}
            >
              {on && (
                <motion.span
                  layoutId="dayPicker"
                  className="grad absolute inset-0 rounded-md shadow-[0_4px_14px_-6px_rgb(var(--glow)/0.9)]"
                  transition={spring}
                />
              )}
              <span className="relative">{d}</span>
            </motion.button>
          );
        })}
      </div>
      {value > 28 && (
        <p className="mt-1.5 text-[11.5px] text-warning">
          Months without a {value}th use their last day instead.
        </p>
      )}
    </div>
  );
}

/* ── modal ─────────────────────────────────────────────────────────────── */

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="show"
          exit="exit"
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-5 backdrop-blur-sm"
        >
          <motion.div
            variants={panelVariants}
            onClick={(e) => e.stopPropagation()}
            className="surface w-full max-w-md p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="font-display text-xl font-bold">{title}</h2>
              <IconButton onClick={onClose} aria-label="Close">
                <X size={16} />
              </IconButton>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── table ─────────────────────────────────────────────────────────────── */

export function TableShell({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="surface overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse">
        <thead>
          <tr className="border-b border-rule bg-page2/60">{head}</tr>
        </thead>
        <motion.tbody variants={staggerParent} initial="hidden" animate="show">
          {children}
        </motion.tbody>
      </table>
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-3 rounded-lg border border-critical/40 bg-critical/10 px-3 py-2 text-[12.5px] text-critical"
    >
      {children}
    </motion.p>
  );
}

export function Dot({ color, size = 9 }: { color: string; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full align-middle"
      style={{ backgroundColor: color, width: size, height: size }}
    />
  );
}
