export type CategoryType = "expense" | "fixed" | "saved" | "budget";

export type Category = {
  id: number;
  name: string;
  slug: string;
  type: CategoryType;
  color: string;
  sort_order: number;
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
