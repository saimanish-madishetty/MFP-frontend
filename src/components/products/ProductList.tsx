"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { formatINR } from "@/lib/format";
import { formatStock, groupProducts, perUnit, sizeLabel, type Product } from "@/lib/products";
import { searchFilter } from "@/lib/search";
import { Badge, ButtonLink, Empty, ErrorBox, Input, Loading } from "@/components/ui";

/** Searchable product cards with ready stock. Used on the Products page and the Stock → Products tab. */
export function ProductList() {
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const { data, error, isLoading } = useSWR<Product[]>(`/products${showArchived ? "?includeInactive=true" : ""}`);
  const term = search.trim().toLowerCase();
  const shown = groupProducts(searchFilter(data ?? [], term, (p) => [p.internalName, p.publicName, p.code]));

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
        {shown.map((l) =>
          l.kind === "group" ? (
            <li key={l.key} className="sm:col-span-2">
              <GroupCard name={l.group.name} groupId={l.group.id} sizes={l.sizes} searching={term !== ""} />
            </li>
          ) : (
            <li key={l.key}>
              <ProductCard p={l.product} />
            </li>
          )
        )}
      </ul>
    </div>
  );
}

const prices = (p: Product) =>
  p.pack.units
    .filter((u) => u.priceSet)
    .map((u) => `${formatINR(u.price ?? 0)} ${perUnit(u.unit)}`)
    .join(" · ");

const stockClass = (p: Product) =>
  `font-semibold tabular-nums ${Number(p.currentQty) <= 0 ? "text-red-600 dark:text-red-400" : ""}`;

function ProductCard({ p }: { p: Product }) {
  return (
    <Link
      href={`/products/detail/?id=${p.id}`}
      className="block rounded-xl border border-border bg-surface p-4 hover:border-brand"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{p.internalName}</p>
          <p className="truncate text-xs text-muted">
            {p.pack.description} · on invoice: {p.publicName}
          </p>
        </div>
        {!p.active && <Badge>Archived</Badge>}
      </div>
      <div className="mt-3 flex items-end justify-between text-sm">
        <span className="tabular-nums">{prices(p)}</span>
        <span className={stockClass(p)}>{formatStock(p, p.currentQty)} ready</span>
      </div>
    </Link>
  );
}

/** Total ready stock of all sizes, when they're packed alike (same units per pack); else null. */
function totalStock(sizes: Product[]): string | null {
  const key = (p: Product) => `${p.saleUnit}|${p.pack.stockUnit}|${p.pack.units.map((u) => u.factor).join(",")}`;
  if (sizes.some((p) => key(p) !== key(sizes[0]))) return null;
  return formatStock(
    sizes[0],
    sizes.reduce((a, p) => a + Number(p.currentQty), 0)
  );
}

/**
 * A product with sizes: a card that opens with the arrow to show a row per size; a size row opens
 * that size. Open while searching, so matching sizes show.
 */
function GroupCard({
  name,
  groupId,
  sizes,
  searching,
}: {
  name: string;
  groupId: number;
  sizes: Product[];
  searching: boolean;
}) {
  const [open, setOpen] = useState(false);
  const shown = open || searching;
  const total = totalStock(sizes);
  const empty = sizes.filter((p) => p.active && Number(p.currentQty) <= 0).length;
  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex items-stretch">
        <button
          type="button"
          aria-expanded={shown}
          onClick={() => setOpen(!shown)}
          className="flex min-w-0 flex-1 items-center gap-3 p-4 text-left hover:bg-surface-2/60"
        >
          <span
            aria-hidden
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border text-muted transition-transform ${
              shown ? "rotate-180" : ""
            }`}
          >
            ▾
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{name}</span>
            <span className="block truncate text-xs text-muted">
              {sizes.length} size{sizes.length === 1 ? "" : "s"}
              {!shown && `: ${sizes.map(sizeLabel).join(", ")}`}
              {empty > 0 && <span className="text-red-600 dark:text-red-400"> · {empty} out of stock</span>}
            </span>
          </span>
          {total !== null && <span className="shrink-0 font-semibold tabular-nums">{total}</span>}
        </button>
        <Link
          href={`/products/group/?id=${groupId}`}
          className="flex shrink-0 items-center border-l border-border px-3 text-xs text-brand hover:bg-surface-2/60"
        >
          Details ›
        </Link>
      </div>
      {shown && (
        <ul className="divide-y divide-border border-t border-border">
          {sizes.map((p) => (
            <li key={p.id}>
              <Link
                href={`/products/detail/?id=${p.id}`}
                className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {sizeLabel(p)} {!p.active && <Badge>Archived</Badge>}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {p.pack.description} · {prices(p)}
                  </span>
                </span>
                <span className={stockClass(p)}>{formatStock(p, p.currentQty)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
