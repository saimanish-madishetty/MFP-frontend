import type { Unit } from "./stock";

export type Order = {
  id: number;
  buyer: { id: number; name: string };
  product: { id: number; internalName: string; publicName: string };
  quantity: string;
  unit: Unit;
  orderDate: string;
  /** Deliver by; null = no date */
  dueDate: string | null;
  note: string | null;
  completedAt: string | null;
  overdue: boolean;
};

export type OrdersOverview = { openCount: number; overdueCount: number; next: Order[] };

/** SWR keys to refresh after an order changes. */
export const refreshOrders = (k: unknown) => typeof k === "string" && k.startsWith("/orders");
