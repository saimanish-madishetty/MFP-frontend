import { Badge } from "@/components/ui";
import type { StockStatus } from "@/lib/stock";

export function StockBadge({ status }: { status: StockStatus }) {
  if (status === "NEGATIVE") return <Badge tone="red">Below zero</Badge>;
  if (status === "LOW") return <Badge tone="amber">Low</Badge>;
  return null;
}

export const qtyTone = (status: StockStatus) =>
  status === "NEGATIVE" ? "text-red-600 dark:text-red-400" : status === "LOW" ? "text-amber-600 dark:text-amber-400" : "";
