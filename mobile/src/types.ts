export type Category = {
  id: number;
  name: string;
  type: "need" | "want" | "fixed";
  color: string;
  sort_order: number;
};

export type Transaction = {
  id: number;
  category_id: number;
  category_name: string;
  category_color: string;
  description: string;
  amount: string;
  is_paid: boolean;
  occurred_on: string;
  created_at: string;
  fixed_expense_id: number | null;
};

export type FixedExpense = {
  id: number;
  name: string;
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

export type Budget = {
  id: number;
  category_id: number;
  category_name: string;
  category_color: string;
  month: string;
  limit_amount: string;
  spent: string;
};

export type Goal = {
  id: number;
  name: string;
  target_amount: string;
  saved_amount: string;
  target_date: string | null;
};

export type Summary = {
  month: string;
  total_spent: number;
  budget_total: number;
  by_category: { category_id: number; name: string; color: string; total: number }[];
  recent: Transaction[];
  archives: { month: string; total: number; count: number }[];
};
