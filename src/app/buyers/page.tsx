"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import type { Buyer } from "@/lib/buyers";
import { BalanceText } from "@/components/buyers/BalanceText";
import { Badge, ButtonLink, Empty, ErrorBox, Input, Loading, PageHeader, Segmented } from "@/components/ui";

type Sort = "name" | "due";

export default function BuyersPage() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [showArchived, setShowArchived] = useState(false);
  const { data, error, isLoading } = useSWR<Buyer[]>(`/buyers${showArchived ? "?includeInactive=true" : ""}`);
  const term = search.trim().toLowerCase();
  const shown = (data ?? [])
    .filter(
      (b) =>
        !term ||
        b.name.toLowerCase().includes(term) ||
        b.invoiceName?.toLowerCase().includes(term) ||
        b.city?.toLowerCase().includes(term) ||
        b.phone?.includes(term),
    )
    .sort((a, b) => (sort === "due" ? Number(b.summary.balance) - Number(a.summary.balance) : 0));

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <PageHeader title="Buyers" />
      <div className="flex items-center gap-2">
        <Input placeholder="Search name, city, phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <ButtonLink href="/buyers/new/" className="shrink-0">
          + Add
        </ButtonLink>
      </div>
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived
        </label>
        <div className="w-48">
          <Segmented<Sort>
            value={sort}
            onChange={setSort}
            options={[
              { value: "name", label: "A–Z" },
              { value: "due", label: "Most due" },
            ]}
          />
        </div>
      </div>
      <ErrorBox error={error} />
      {isLoading && <Loading />}
      {data && shown.length === 0 && (
        <Empty>{term ? "Nothing matches your search." : "No buyers yet. Add the shops and distributors you sell to."}</Empty>
      )}
      <ul className="grid gap-2 sm:grid-cols-2">
        {shown.map((b) => (
          <li key={b.id}>
            <Link
              href={`/buyers/detail/?id=${b.id}`}
              className="block rounded-xl border border-border bg-surface p-4 hover:border-brand"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{b.name}</p>
                  <p className="truncate text-xs text-muted">
                    {[b.contactPerson, b.city].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {!b.active && <Badge>Archived</Badge>}
                  {b.summary.overdueCount > 0 && <Badge tone="red">Overdue</Badge>}
                </div>
              </div>
              <p className="mt-3 text-right font-semibold tabular-nums">
                <BalanceText balance={b.summary.balance} />
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
