export type CategoryType = "expense" | "fixed" | "saved" | "budget";

export type Module = {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon: string;
  home_page: string | null;
  sort_order: number;
  active: boolean;
};

export type Category = {
  id: number;
  name: string;
  slug: string;
  type: CategoryType;
  color: string;
  sort_order: number;
  active: boolean;
};

export type FixedExpense = {
  id: number;
  name: string;
  slug: string;
  description: string;
  amount: string;
  due_day: number;
  active: boolean;
  category_id: number;
  category_name: string;
  category_color: string;
  transaction_id: number | null;
  is_paid: boolean | null;
  status: "paid" | "due" | "unlogged";
};

export type Transaction = {
  id: number;
  category_id: number;
  category_name: string;
  category_color: string;
  category_type: CategoryType;
  description: string;
  amount: string;
  is_paid: boolean;
  occurred_on: string;
  created_at: string;
  fixed_expense_id: number | null;
};

export type Budget = {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: string;
  category_id: number;
  category_name: string;
  category_color: string;
  spent: string;
  remaining: string;
  active: boolean;
};

export type Goal = {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: string;
  category_id: number;
  category_name: string;
  category_color: string;
  saved: string;
  remaining: string;
  target_date: string | null;
  active: boolean;
};

export type Summary = {
  month: string;
  total_expense: number;
  total_saved: number;
  total_categories: number;
  total_transactions: number;
  by_category: { category_id: number; name: string; color: string; total: number }[];
  recent: Transaction[];
  archives: { month: string; total: number; count: number }[];
  budgets: Budget[];
  goals: Goal[];
};

export type Exercise = {
  id: number;
  name: string;
  slug: string;
  muscle_group: string;
  equipment: string;
  notes: string;
  sort_order: number;
  active: boolean;
  media_url: string | null;
  media_public_id: string | null;
  media_type: "image" | "video" | null;
};

export type WorkoutSet = {
  id: number;
  session_id: number;
  exercise_id: number;
  exercise_name: string;
  muscle_group: string;
  reps: number;
  weight: string;
  set_order: number;
};

export type WorkoutSession = {
  id: number;
  name: string;
  occurred_on: string;
  notes: string;
  set_count: number;
  total_reps: number;
  volume: number;
  sets?: WorkoutSet[];
};

export type WorkoutSummary = {
  this_week: { sessions: number; volume: number; reps: number };
  last_week: { sessions: number; volume: number };
  totals: { total_sessions: number; active_exercises: number; total_sets: number };
  recent: WorkoutSession[];
  top_exercises: { name: string; volume: number; sets: number }[];
};

/* ── Timetable ───────────────────────────────────────────────────────────
   day_of_week follows Postgres: 0 = Sunday … 6 = Saturday. event_date null
   means it repeats every week on that day. Times are "HH:MM" wall clock. */
export type TimetableEvent = {
  id: number;
  title: string;
  notes: string;
  location: string;
  color: string;
  day_of_week: number;
  event_date: string | null;
  starts_at: string;
  ends_at: string;
  remind_minutes: number | null;
  active: boolean;
};

/** One expanded occurrence from /api/timetable/occurrences. */
export type TimetableOccurrence = TimetableEvent & { date: string };

/* ── Todo ────────────────────────────────────────────────────────────── */
export type TodoList = {
  id: number;
  name: string;
  slug: string;
  icon: string;
  color: string;
  sort_order: number;
  active: boolean;
  open_count: number;
  done_count: number;
  overdue_count: number;
  next_due: string | null;
};

export type TodoItem = {
  id: number;
  list_id: number;
  title: string;
  notes: string;
  due_date: string | null;
  /** 0 none, 1 medium, 2 high. */
  priority: number;
  done: boolean;
  done_at: string | null;
  sort_order: number;
  created_at: string;
  list_name: string;
  list_color: string;
  list_icon: string;
};
