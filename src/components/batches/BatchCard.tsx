"use client";

import Link from "next/link";
import { ago, daysBetween, STATUS_LABEL, type BatchListItem } from "@/lib/batches";
import { formatDay, todayIST } from "@/lib/format";
import { formatStock, sizeLabel, type Product } from "@/lib/products";
import { formatQty } from "@/lib/stock";
import { Badge } from "@/components/ui";

/** Dots for the stages: filled up to the one reached. */
export function StageDots({ total, reached }: { total: number; reached: number }) {
  return (
    <span className="flex gap-1" aria-label={`Stage ${reached + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= reached ? "bg-brand" : "bg-surface-2"}`} />
      ))}
    </span>
  );
}

/** A batch in a list: its stage while in process, what it made once finished. */
export function BatchCard({ batch: b, productById }: { batch: BatchListItem; productById: Map<number, Product> }) {
  const today = todayIST();
  const days = daysBetween(b.startDate, today);
  return (
    <Link
      href={`/batches/detail/?id=${b.id}`}
      className="block space-y-2 rounded-xl border border-border bg-surface p-3 text-sm hover:border-brand"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">
            {b.plan.name} <span className="font-normal text-muted">· {b.number}</span>
          </p>
          {b.status === "OPEN" ? (
            <p>
              <span className="font-medium text-brand">{b.stages[b.stage]}</span>
              <span className="text-xs text-muted">
                {" "}
                · stage {b.stage + 1} of {b.stages.length} · {ago(b.stageDate, today)}
              </span>
            </p>
          ) : (
            <p className="text-xs text-muted">
              {formatDay(b.startDate, { weekday: false })} → {b.endDate && formatDay(b.endDate, { weekday: false })}
              {b.status === "CANCELLED" && (b.materialsLost ? " · materials lost" : " · materials put back")}
            </p>
          )}
        </div>
        {b.status === "OPEN" ? (
          <span className={`shrink-0 text-xs ${days >= 3 ? "text-amber-600 dark:text-amber-400" : "text-muted"}`}>
            started {ago(b.startDate, today)}
          </span>
        ) : (
          <Badge tone={b.status === "FINISHED" ? "green" : "red"}>{STATUS_LABEL[b.status]}</Badge>
        )}
      </div>
      {b.status === "OPEN" && <StageDots total={b.stages.length} reached={b.stage} />}
      {b.status === "OPEN" && b.productIds.length > 0 && (
        <p className="truncate text-xs">
          Sizes:{" "}
          {b.productIds
            .map((pid) => productById.get(pid))
            .filter((p): p is Product => !!p)
            .map((p) => (p.group ? sizeLabel(p) : p.internalName))
            .join(", ")}
        </p>
      )}
      {b.materials.length > 0 && (
        <p className="text-xs text-muted">
          {b.materials.map((m) => `${m.name} ${formatQty(m.quantity, m.unit)}`).join(" · ")}
        </p>
      )}
      {b.products.length > 0 && (
        <p className="text-xs text-muted">
          {b.products
            .map((m) => {
              const p = productById.get(m.productId);
              return p ? `${p.internalName}: ${formatStock(p, m.stockQty)}` : null;
            })
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
    </Link>
  );
}
