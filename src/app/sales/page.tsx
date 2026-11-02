"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { formatDay, formatINR } from "@/lib/format";
import { saleStatus, type SaleListItem, type SaleStatusFilter } from "@/lib/sales";
import { Badge, ButtonLink, Empty, ErrorBox, Input, Loading, PageHeader } from "@/components/ui";

const FILTERS: { value: SaleStatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "PAID", label: "Paid" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function SalesPage() {
  const [status, setStatus] = useState<SaleStatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const query = new URLSearchParams();
  if (status !== "ALL") query.set("status", status);
  if (search.trim()) query.set("q", search.trim());
  const qs = query.toString();
  const { data, error, isLoading } = useSWR<SaleListItem[]>(`/sales${qs ? `?${qs}` : ""}`);

  const total = data?.filter((s) => !s.cancelledAt).reduce((a, s) => a + Number(s.grandTotal), 0) ?? 0;

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
      <Input placeholder="Search invoice no. or buyer…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatus(f.value)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
              status === f.value ? "border-brand bg-brand/15 text-brand" : "border-border"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <ErrorBox error={error} />
      {isLoading && <Loading />}
      {data && data.length === 0 && (
        <Empty>{status === "ALL" && !search ? "No invoices yet. Create your first sale." : "No invoices match."}</Empty>
      )}
      {data && data.length > 0 && (
        <p className="text-right text-xs text-muted">
          {data.length} invoice{data.length === 1 ? "" : "s"} · {formatINR(total)}
        </p>
      )}
      <ul className="space-y-2">
        {data?.map((s) => {
          const st = saleStatus(s);
          const due = Number(s.grandTotal) - Number(s.amountPaid);
          return (
            <li key={s.id}>
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
                  <span className={`font-semibold tabular-nums ${s.cancelledAt ? "text-muted line-through" : ""}`}>
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
