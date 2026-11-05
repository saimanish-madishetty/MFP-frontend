"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import useSWR from "swr";
import type { Buyer } from "@/lib/buyers";
import {
  addDays,
  addMonths,
  formatDay,
  formatINR,
  todayIST,
} from "@/lib/format";
import type { Product } from "@/lib/products";
import {
  saleStatus,
  type SaleListItem,
  type SaleSearch,
  type SaleSort,
  type SaleStatusFilter,
} from "@/lib/sales";
import {
  Badge,
  Button,
  ButtonLink,
  Empty,
  ErrorBox,
  Field,
  Input,
  Loading,
  PageHeader,
  Select,
} from "@/components/ui";

const STATUSES: { value: SaleStatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "PAID", label: "Paid" },
  { value: "CANCELLED", label: "Cancelled" },
];

type Period =
  | "all"
  | "today"
  | "yesterday"
  | "week"
  | "month"
  | "lastmonth"
  | "fy"
  | "custom";

const PERIODS: { value: Period; label: string }[] = [
  { value: "all", label: "All dates" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "lastmonth", label: "Last month" },
  { value: "fy", label: "This financial year" },
  { value: "custom", label: "Pick dates…" },
];

const SORTS: { value: SaleSort; label: string }[] = [
  { value: "new", label: "Newest first" },
  { value: "old", label: "Oldest first" },
  { value: "high", label: "Highest amount" },
  { value: "low", label: "Lowest amount" },
];

const PAGE = 50;

/** From / to dates for a period (custom uses the dates picked). */
function range(
  period: Period,
  from: string,
  to: string
): { from?: string; to?: string } {
  const today = todayIST();
  const month = today.slice(0, 7);
  switch (period) {
    case "today":
      return { from: today, to: today };
    case "yesterday":
      return { from: addDays(today, -1), to: addDays(today, -1) };
    case "week": {
      // Monday to today
      const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
      return { from: addDays(today, -dow), to: today };
    }
    case "month":
      return { from: `${month}-01`, to: today };
    case "lastmonth": {
      const last = addMonths(month, -1);
      return { from: `${last}-01`, to: addDays(`${month}-01`, -1) };
    }
    case "fy": {
      // April to March
      const y =
        Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) < 4 ? 1 : 0);
      return { from: `${y}-04-01`, to: today };
    }
    case "custom":
      return { from: from || undefined, to: to || undefined };
    default:
      return {};
  }
}

function SalesList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const get = (k: string) => params.get(k) ?? "";

  // Filters live in the URL, so they survive opening an invoice and coming back.
  const status = (STATUSES.find((s) => s.value === get("status"))?.value ??
    "ALL") as SaleStatusFilter;
  const period = (PERIODS.find((p) => p.value === get("period"))?.value ??
    "all") as Period;
  const sort = (SORTS.find((s) => s.value === get("sort"))?.value ??
    "new") as SaleSort;
  const buyerId = get("buyer");
  const productId = get("product");
  const q = get("q");
  const dates = range(period, get("from"), get("to"));

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const s = next.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };

  // Search box: typed text goes to the URL after a short pause.
  const [search, setSearch] = useState(q);
  useEffect(() => {
    if (search.trim() === q) return;
    const t = setTimeout(() => set({ q: search.trim() }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { data: buyers } = useSWR<Buyer[]>("/buyers");
  const { data: products } = useSWR<Product[]>(
    "/products?includeInactive=true"
  );

  const query = new URLSearchParams();
  if (status !== "ALL") query.set("status", status);
  if (buyerId) query.set("buyerId", buyerId);
  if (productId) query.set("productId", productId);
  if (dates.from) query.set("from", dates.from);
  if (dates.to) query.set("to", dates.to);
  if (q) query.set("q", q);
  if (sort !== "new") query.set("sort", sort);
  const filterKey = query.toString();

  // "Show more" loads further pages; any filter change starts again from the first.
  const [shown, setShown] = useState({ key: filterKey, limit: PAGE });
  const limit = shown.key === filterKey ? shown.limit : PAGE;
  query.set("limit", String(limit));
  const { data, error, isLoading, isValidating } = useSWR<SaleSearch>(
    `/sales/search?${query}`,
    {
      keepPreviousData: true,
    }
  );

  const filtered =
    status !== "ALL" ||
    period !== "all" ||
    buyerId !== "" ||
    productId !== "" ||
    q !== "" ||
    sort !== "new";
  const byDate = sort === "new" || sort === "old";

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <PageHeader
        title="Sales"
        actions={
          <ButtonLink href="/sales/new/" size="lg">
            + New sale
          </ButtonLink>
        }
      />

      <Input
        type="search"
        placeholder="Search invoice no. or buyer…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {STATUSES.map((f) => (
          <button
            key={f.value}
            onClick={() => set({ status: f.value === "ALL" ? "" : f.value })}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
              status === f.value
                ? "border-brand bg-brand/15 text-brand"
                : "border-border"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Select
          aria-label="Dates"
          value={period}
          onChange={(e) =>
            set({ period: e.target.value === "all" ? "" : e.target.value })
          }
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Buyer"
          searchable
          value={buyerId}
          onChange={(e) => set({ buyer: e.target.value })}
        >
          <option value="">All buyers</option>
          {buyers?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
              {b.city ? ` · ${b.city}` : ""}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Product"
          searchable
          value={productId}
          onChange={(e) => set({ product: e.target.value })}
        >
          <option value="">All products</option>
          {products?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.internalName}
              {p.active ? "" : " (archived)"}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Sort"
          value={sort}
          onChange={(e) =>
            set({ sort: e.target.value === "new" ? "" : e.target.value })
          }
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
      {period === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="From">
            <Input
              type="date"
              max={get("to") || todayIST()}
              value={get("from")}
              onChange={(e) => set({ from: e.target.value })}
            />
          </Field>
          <Field label="To">
            <Input
              type="date"
              min={get("from") || undefined}
              max={todayIST()}
              value={get("to")}
              onChange={(e) => set({ to: e.target.value })}
            />
          </Field>
        </div>
      )}

      <ErrorBox error={error} />
      {isLoading && !data && <Loading />}

      {data && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg bg-surface-2 px-3 py-2 text-sm">
          <span>
            <span className="font-semibold">{data.count}</span> invoice
            {data.count === 1 ? "" : "s"}
            {dates.from && (
              <span className="text-muted">
                {" "}
                · {formatDay(dates.from, { weekday: false })}
                {dates.to && dates.to !== dates.from
                  ? ` – ${formatDay(dates.to, { weekday: false })}`
                  : ""}
              </span>
            )}
          </span>
          <span className="tabular-nums">
            <span className="font-semibold">{formatINR(data.total)}</span>
            {Number(data.due) > 0 && (
              <span className="text-amber-700 dark:text-amber-400">
                {" "}
                · {formatINR(data.due)} due
              </span>
            )}
          </span>
          {filtered && (
            <button
              className="text-xs text-brand"
              onClick={() => {
                setSearch("");
                router.replace(pathname, { scroll: false });
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {data && data.items.length === 0 && (
        <Empty>
          {filtered
            ? "No invoices match these filters."
            : "No invoices yet. Create your first sale."}
        </Empty>
      )}

      <ul className={`space-y-2 ${isValidating && data ? "opacity-70" : ""}`}>
        {data?.items.map((s, i) => {
          const header =
            byDate && (i === 0 || data.items[i - 1].date !== s.date);
          return (
            <li key={s.id}>
              {header && (
                <p
                  className={`px-1 pb-1 text-xs font-medium text-muted ${
                    i === 0 ? "" : "pt-2"
                  }`}
                >
                  {s.date === todayIST() ? "Today" : formatDay(s.date)}
                </p>
              )}
              <SaleRow s={s} />
            </li>
          );
        })}
      </ul>

      {data?.hasMore && (
        <div className="flex flex-col items-center gap-1 pb-4">
          <Button
            variant="secondary"
            disabled={isValidating}
            onClick={() => setShown({ key: filterKey, limit: limit + PAGE })}
          >
            {isValidating ? "Loading…" : "Show more"}
          </Button>
          <span className="text-xs text-muted">
            Showing {data.items.length} of {data.count}
          </span>
        </div>
      )}
    </div>
  );
}

function SaleRow({ s }: { s: SaleListItem }) {
  const st = saleStatus(s);
  const due = Number(s.grandTotal) - Number(s.amountPaid);
  return (
    <Link
      href={`/sales/detail/?id=${s.id}`}
      className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 hover:border-brand"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{s.buyerName}</p>
        <p className="truncate text-xs text-muted">
          {s.invoiceNumber} · {formatDay(s.date, { year: false })}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={`font-semibold tabular-nums ${
            s.cancelledAt ? "text-muted line-through" : ""
          }`}
        >
          {formatINR(s.grandTotal)}
        </span>
        <span className="flex items-center gap-1">
          {s.paymentStatus === "PARTIAL" && !s.cancelledAt && (
            <span className="text-xs text-muted">{formatINR(due)} left</span>
          )}
          <Badge tone={st.tone}>{st.label}</Badge>
        </span>
      </div>
    </Link>
  );
}

export default function SalesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SalesList />
    </Suspense>
  );
}
