import { formatINR } from "@/lib/format";

/** "₹1,200 due", "Nothing due", or "₹300 advance" when the buyer has paid extra. */
export function BalanceText({ balance }: { balance: string }) {
  const n = Number(balance);
  if (n < 0) return <span className="text-green-700 dark:text-green-400">{formatINR(-n)} advance</span>;
  if (n === 0) return <span className="text-muted">Nothing due</span>;
  return <span>{formatINR(n)} due</span>;
}
