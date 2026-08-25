import { parseDate } from "./api";

/** 0 none, 1 medium, 2 high — kept numeric so the API can sort on it. */
export const PRIORITIES = [
  { value: 0, label: "Normal", color: "var(--ink-muted)" },
  { value: 1, label: "Medium", color: "var(--warning)" },
  { value: 2, label: "High", color: "var(--critical)" },
] as const;

export const priority = (n: number) => PRIORITIES.find((p) => p.value === n) ?? PRIORITIES[0];

export const LIST_ICONS = ["🏠", "🚗", "🛒", "💼", "🎓", "🧰", "✈️", "🎁", "💊", "📚", "🐾", "🌱"];

/** How a due date reads relative to today, plus the tone it should wear.
 *  Comparison is done on calendar days, not instants, so "today" doesn't
 *  flip at 00:00 UTC. */
export function dueLabel(iso: string): { text: string; tone: "bad" | "warn" | "neutral" } {
  const due = parseDate(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (days < 0) return { text: days === -1 ? "Yesterday" : `${Math.abs(days)} days late`, tone: "bad" };
  if (days === 0) return { text: "Today", tone: "warn" };
  if (days === 1) return { text: "Tomorrow", tone: "warn" };
  if (days <= 6) return { text: due.toLocaleDateString(undefined, { weekday: "long" }), tone: "neutral" };
  return {
    text: due.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    tone: "neutral",
  };
}
