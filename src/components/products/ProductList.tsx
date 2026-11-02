"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { formatINR } from "@/lib/format";
import type { Product } from "@/lib/products";
import { formatQty } from "@/lib/stock";
import { Badge, ButtonLink, Empty, ErrorBox, Input, Loading } from "@/components/ui";

/** Searchable product cards with ready stock. Used on the Products page and the Stock → Products tab. */
export function ProductList() {
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const { data, error, isLoading } = useSWR<Product[]>(`/products${showArchived ? "?includeInactive=true" : ""}`);
  const term = search.trim().toLowerCase();
  const shown = (data ?? []).filter(
    (p) =>
      !term ||
      p.internalName.toLowerCase().includes(term) ||
      p.publicName.toLowerCase().includes(term) ||
      p.code?.toLowerCase().includes(term),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <ButtonLink href="/products/new/" className="shrink-0">
          + Add
        </ButtonLink>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Show archived
      </label>
      <ErrorBox error={error} />
      {isLoading && <Loading />}
      {data && shown.length === 0 && (
        <Empty>{term ? "Nothing matches your search." : "No products yet. Add the products you make and sell."}</Empty>
      )}
      <ul className="grid gap-2 sm:grid-cols-2">
        {shown.map((p) => (
          <li key={p.id}>
            <Link
              href={`/products/detail/?id=${p.id}`}
              className="block rounded-xl border border-border bg-surface p-4 hover:border-brand"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.internalName}</p>
                  <p className="truncate text-xs text-muted">On invoice: {p.publicName}</p>
                </div>
                {!p.active && <Badge>Archived</Badge>}
              </div>
              <div className="mt-3 flex items-end justify-between text-sm">
                <span className="tabular-nums">{formatINR(p.price)}</span>
                <span
                  className={`font-semibold tabular-nums ${
                    Number(p.currentQty) <= 0 ? "text-red-600 dark:text-red-400" : ""
                  }`}
                >
                  {formatQty(p.currentQty, p.saleUnit)} ready
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
