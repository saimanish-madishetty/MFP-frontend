"use client";

import Link from "next/link";
import useSWR from "swr";
import { Badge, ErrorBox } from "@/components/ui";
import { formatDay, formatINR } from "@/lib/format";
import { saleStatus, type SaleListItem } from "@/lib/sales";
import { formatStock, type Pack } from "@/lib/products";
import { useAuth } from "@/lib/use-auth";
import { formatQty, type StockOverview, type Unit } from "@/lib/stock";
import type { OrdersOverview } from "@/lib/orders";

type SalesOverview = {
  today: { amount: string; count: number };
  month: { amount: string; count: number };
  recent: SaleListItem[];
};

type BuyersOverview = { buyers: number; outstanding: string; overdueAmount: string; overdueBuyers: number };

type ProductsOverview = {
  products: number;
  outOfStock: number;
  stock: { id: number; internalName: string; currentQty: string; saleUnit: Unit; pack: Pack }[];
};

function StatCard({
  label,
  value,
  href,
  hint,
  tone,
}: {
  label: string;
  value: string;
  href: string;
  hint?: string;
  tone?: "red";
}) {
  return (
    <Link href={href} className="rounded-xl border border-border bg-surface p-4 hover:border-brand">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "red" ? "text-red-600 dark:text-red-400" : ""}`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 truncate text-xs text-muted">{hint}</p>}
    </Link>
  );
}

const QUICK_ACTIONS = [
  { label: "New sale", href: "/sales/new/", icon: "M12 5v14M5 12h14" },
  {
    label: "Add production",
    href: "/production/",
    icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  },
  { label: "View stock", href: "/stock/", icon: "M4 6h16M4 12h16M4 18h16", readOnly: true },
  {
    label: "Add buyer",
    href: "/buyers/new/",
    icon: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM19 8v6M22 11h-6",
  },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted">{title}</h2>
      {children}
    </section>
  );
}

export default function DashboardPage() {
  const { canEdit } = useAuth();
  const { data: sales, error } = useSWR<SalesOverview>("/sales/overview");
  const { data: buyers } = useSWR<BuyersOverview>("/buyers/overview");
  const { data: products } = useSWR<ProductsOverview>("/products/overview");
  const { data: s } = useSWR<StockOverview>("/stock/overview");
  const { data: orders } = useSWR<OrdersOverview>("/orders/overview");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {/* Hot keys: the actions used most often. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_ACTIONS.filter((a) => canEdit || ("readOnly" in a && a.readOnly)).map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-surface p-3 text-center font-medium hover:border-brand hover:text-brand"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6 text-brand"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d={a.icon} />
            </svg>
            <span className="text-sm">{a.label}</span>
          </Link>
        ))}
      </div>

      <ErrorBox error={error} />

      <Section title="Orders">
        <Link
          href="/orders/"
          className="block rounded-xl border border-border bg-surface p-4 text-sm hover:border-brand"
        >
          <p className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-semibold tabular-nums">{orders ? orders.openCount : "—"}</span>
            <span className="text-xs text-muted">
              open{orders && orders.overdueCount > 0 && (
                <span className="text-red-600 dark:text-red-400"> · {orders.overdueCount} late</span>
              )}{" "}
              · see all ›
            </span>
          </p>
          {orders?.next.map((o) => (
            <p key={o.id} className="mt-1 flex justify-between gap-2">
              <span className="truncate">
                {o.product.internalName} <span className="text-muted">· {o.buyer.name}</span>
              </span>
              <span className={`shrink-0 tabular-nums ${o.overdue ? "text-red-600 dark:text-red-400" : ""}`}>
                {formatQty(o.quantity, o.unit)}
                {o.dueDate && <span className="text-xs text-muted"> · {formatDay(o.dueDate, { year: false })}</span>}
              </span>
            </p>
          ))}
        </Link>
      </Section>

      <Section title="Sales & payments">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Sales today"
            value={sales ? formatINR(sales.today.amount) : "—"}
            href="/sales/"
            hint={sales ? `${sales.today.count} invoice${sales.today.count === 1 ? "" : "s"}` : undefined}
          />
          <StatCard
            label="This month"
            value={sales ? formatINR(sales.month.amount) : "—"}
            href="/sales/"
            hint={sales ? `${sales.month.count} invoices` : undefined}
          />
          <StatCard label="To collect" value={buyers ? formatINR(buyers.outstanding) : "—"} href="/buyers/" />
          <StatCard
            label="Overdue"
            value={buyers ? formatINR(buyers.overdueAmount) : "—"}
            href="/sales/"
            tone={buyers && Number(buyers.overdueAmount) > 0 ? "red" : undefined}
            hint={
              buyers && buyers.overdueBuyers > 0
                ? `${buyers.overdueBuyers} buyer${buyers.overdueBuyers > 1 ? "s" : ""}`
                : undefined
            }
          />
        </div>
        {sales && sales.recent.length > 0 && (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface text-sm">
            {sales.recent.map((r) => {
              const st = saleStatus(r);
              return (
                <li key={r.id}>
                  <Link
                    href={`/sales/detail/?id=${r.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:text-brand"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {r.buyerName} <span className="text-xs text-muted">· {formatDay(r.date, { year: false })}</span>
                    </span>
                    <span className="tabular-nums">{formatINR(r.grandTotal)}</span>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Stock">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Production today"
            value={s ? (s.dayEndDoneToday ? "Done ✓" : "Not entered") : "—"}
            href="/production/"
            hint={
              s && !s.dayEndDoneToday && s.lastDayEndOn
                ? `Last: ${formatDay(s.lastDayEndOn, { year: false })}`
                : undefined
            }
          />
          <StatCard
            label="Low materials"
            value={s ? String(s.lowStock.length + s.negativeStock.length) : "—"}
            href="/stock/"
            tone={s && s.negativeStock.length > 0 ? "red" : undefined}
            hint={[...(s?.negativeStock ?? []), ...(s?.lowStock ?? [])].map((m) => m.name).join(", ") || undefined}
          />
          <StatCard
            label="Products out of stock"
            value={products ? String(products.outOfStock) : "—"}
            href="/stock/?tab=products"
            tone={products && products.outOfStock > 0 ? "red" : undefined}
          />
          <Link
            href="/stock/?tab=products"
            className="col-span-2 rounded-xl border border-border bg-surface p-4 text-sm hover:border-brand lg:col-span-1"
          >
            <p className="text-xs text-muted">Ready stock</p>
            {products?.stock.length ? (
              products.stock.slice(0, 4).map((p) => (
                <p key={p.id} className="mt-1 flex justify-between gap-2">
                  <span className="truncate">{p.internalName}</span>
                  <span className="shrink-0 tabular-nums">{formatStock(p, p.currentQty)}</span>
                </p>
              ))
            ) : (
              <p className="mt-1 text-muted">—</p>
            )}
          </Link>
        </div>
      </Section>
    </div>
  );
}
