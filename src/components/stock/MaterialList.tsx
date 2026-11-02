"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { formatINR } from "@/lib/format";
import { formatQty, unitShort, type MaterialListItem, type MaterialType } from "@/lib/stock";
import { Badge, ButtonLink, Empty, ErrorBox, Input, Loading } from "@/components/ui";
import { StockBadge, qtyTone } from "./StockBadge";

/** Materials of one type (raw materials or supplies). The type is picked by the Stock page tabs. */
export function MaterialList({ type }: { type: MaterialType }) {
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const { data, error, isLoading } = useSWR<MaterialListItem[]>(
    `/materials${showArchived ? "?includeInactive=true" : ""}`,
  );

  const term = search.trim().toLowerCase();
  const shown = (data ?? []).filter((m) => m.type === type && (!term || m.name.toLowerCase().includes(term)));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <ButtonLink href={`/stock/new/?type=${type}`} className="shrink-0">
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
        <Empty>
          {term
            ? "Nothing matches your search."
            : type === "RAW"
            ? "No raw materials yet. Add ingredients like maida, salt or oil."
            : "No supplies yet. Add packaging like pouches, cartons or labels."}
        </Empty>
      )}

      <ul className="grid gap-2 sm:grid-cols-2">
        {shown.map((m) => (
          <li key={m.id}>
            <Link
              href={`/stock/detail/?id=${m.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 hover:border-brand"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{m.name}</p>
                <p className="truncate text-xs text-muted">
                  {m.lastCostPerUnit ? `${formatINR(m.lastCostPerUnit)} / ${unitShort(m.unit)}` : "No cost yet"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className={`text-lg font-semibold tabular-nums ${qtyTone(m.status)}`}>
                  {formatQty(m.currentQty, m.unit)}
                </span>
                {m.active ? <StockBadge status={m.status} /> : <Badge>Archived</Badge>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
