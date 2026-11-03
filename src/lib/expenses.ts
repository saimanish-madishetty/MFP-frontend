import type { PaymentMode } from "./workers";

export type Expense = {
  id: number;
  date: string;
  amount: string;
  category: string;
  note: string | null;
  mode: PaymentMode;
};

export type ExpenseMonth = {
  month: string;
  total: string;
  byCategory: { category: string; total: string }[];
  items: Expense[];
};

export type Bill = {
  id: number;
  name: string;
  amount: string;
  billDate: string | null;
  dueDate: string;
  paidOn: string | null;
  mode: PaymentMode | null;
  reference: string | null;
  note: string | null;
  overdue: boolean;
};

export type ExpensesOverview = {
  expensesToday: string;
  expensesMonth: { amount: string; count: number };
  billsPaidMonth: string;
  billsDue: {
    count: number;
    amount: string;
    overdueCount: number;
    overdueAmount: string;
    next: { id: number; name: string; amount: string; dueDate: string }[];
  };
};

/** Shown as suggestions until the owner's own categories take over. */
export const DEFAULT_CATEGORIES = ["Transport", "Tea & snacks", "Repairs", "Cleaning", "Stationery", "Other"];

/** Refreshes everything that shows expense or bill figures. */
export const refreshExpenses = (k: unknown) =>
  typeof k === "string" && (k.startsWith("/expenses") || k.startsWith("/bills"));
