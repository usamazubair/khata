import { isoDate } from "./schedule";
import { TodoItem } from "../types";

export const DUE_FILTERS = ["Today", "Tomorrow", "All"] as const;
export type DueFilter = (typeof DUE_FILTERS)[number];

/** Narrows a task list down to what's due today/tomorrow, or leaves it
 *  alone for "All". A task with no due date only ever shows under "All". */
export function filterByDue<T extends Pick<TodoItem, "due_date">>(items: T[], filter: DueFilter): T[] {
  if (filter === "All") return items;
  const target = filter === "Today" ? isoDate(new Date()) : isoDate(new Date(Date.now() + 86_400_000));
  return items.filter((i) => i.due_date === target);
}
