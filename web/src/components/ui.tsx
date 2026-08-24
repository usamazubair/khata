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
          <p className="mb-1.5 font-mono text-[11px] tracking-[0.09em] text-accent uppercase">{eyebrow}</p>
        )}
        <h1 className="font-display text-3xl leading-tight">{title}</h1>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  );
}

export function Card({ className, children, ...rest }: React.ComponentProps<typeof motion.div>) {
  return (
    <motion.div
      variants={riseItem}
      className={cx("rounded-2xl border border-rule bg-page p-5", className)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2.5 font-mono text-[10px] tracking-[0.06em] text-muted uppercase">{children}</div>
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
  return (
    <motion.div
      variants={riseItem}
      className="rounded-xl border border-rule bg-page px-4 py-3.5"
    >
      <div className="font-mono text-[10px] tracking-[0.06em] text-muted uppercase">{label}</div>
      <div
        className={cx(
          "num mt-1 text-[22px] font-semibold",
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

export function ProgressBar({ pct, color = "var(--accent-2)" }: { pct: number; color?: string }) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-rule">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
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
    primary: "bg-accent text-accent-ink hover:brightness-110",
    ghost: "border border-rule text-muted hover:text-ink hover:border-muted",
    danger: "border border-critical/60 text-critical hover:bg-critical/10",
  }[variant];

  return (
    <motion.button
      whileTap={tapScale}
      transition={spring}
      className={cx(
        "cursor-pointer rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-colors disabled:cursor-default disabled:opacity-60",
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
  tone?: "neutral" | "good" | "warn" | "bad";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-page2 text-muted",
    good: "bg-good/15 text-good",
    warn: "bg-warning/20 text-warning",
    bad: "bg-critical/15 text-critical",
  }[tone];
  return (
    <span className={cx("inline-flex rounded-full px-2.5 py-1 font-mono text-[10.5px] whitespace-nowrap", tones)}>
      {children}
    </span>
  );
}

/** Active/inactive switch — the soft alternative to deleting. */
export function ActiveToggle({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={tapScale}
      className={cx(
        "cursor-pointer rounded-full px-2.5 py-1 font-mono text-[10.5px] transition-colors",
        active ? "bg-good/15 text-good hover:bg-good/25" : "bg-page2 text-muted hover:bg-rule"
      )}
    >
      {active ? "Active" : "Inactive"}
    </motion.button>
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
      className="min-w-44 flex-1 rounded-full border border-rule bg-page px-4 py-2.5 text-[13px] outline-none transition-colors placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
    />
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5 backdrop-blur-sm"
        >
          <motion.div
            variants={panelVariants}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-rule bg-page p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="font-display text-xl">{title}</h2>
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
    <div className="overflow-x-auto rounded-2xl border border-rule bg-page">
      <table className="w-full min-w-[480px] border-collapse">
        <thead>
          <tr className="border-b border-rule">{head}</tr>
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
      className="mb-3 text-[12.5px] text-critical"
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
