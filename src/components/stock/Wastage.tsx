"use client";

import Link from "next/link";
import useSWR from "swr";
import { formatDay, formatINR } from "@/lib/format";
import { formatStock, sizeLabel, type Product } from "@/lib/products";
import { formatQty, type ProductWastage, type WastageLine } from "@/lib/stock";
import { Loading, Row } from "@/components/ui";

const OVER = "text-amber-600 dark:text-amber-400";
const UNDER = "text-green-700 dark:text-green-400";

/** "+0.8 kg (4%)" in amber for waste, green when less than the recipe was used. */
export function WasteText({ line }: { line: WastageLine }) {
  if (line.waste === null) return <span className="text-muted">not in recipe</span>;
  const w = Number(line.waste);
  if (w === 0) return <span className="text-muted">as recipe</span>;
  return (
    <span className={w > 0 ? OVER : UNDER}>
      {w > 0 ? "+" : "−"}
      {formatQty(Math.abs(w), line.material.unit)}
      {line.wastePct !== null && ` (${Math.abs(Number(line.wastePct))}%)`}
    </span>
  );
}

/** "≈ ₹89.60 extra" (amber), "≈ ₹20 saved" (green) or "no extra". */
export function WasteValue({ value, className = "" }: { value: string; className?: string }) {
  const v = Number(value);
  if (v === 0) return <span className={`text-muted ${className}`}>no extra</span>;
  return (
    <span className={`tabular-nums ${v > 0 ? OVER : UNDER} ${className}`}>
      ≈ {formatINR(Math.abs(v))} {v > 0 ? "extra" : "saved"}
    </span>
  );
}

/** Product name, with the size on its own line for a product with sizes. */
export function ProductName({ product, fallback }: { product?: Product; fallback?: string }) {
  if (!product) return <span className="font-medium">{fallback ?? "Deleted product"}</span>;
  return (
    <span className="min-w-0">
      <span className="block font-medium break-words">{product.group?.name ?? product.internalName}</span>
      {product.group && <span className="block text-sm font-semibold text-brand">{sizeLabel(product)}</span>}
    </span>
  );
}

/** Materials used for a product (one day or in total) vs. the recipe. */
export function WasteLines({ lines }: { lines: WastageLine[] }) {
  if (lines.length === 0) return <p className="text-xs text-muted">No raw materials entered for it.</p>;
  return (
    <div className="space-y-0.5">
      {lines.map((m) => (
        <p key={m.material.id} className="flex justify-between gap-2 text-xs">
          <span className="min-w-0 truncate text-muted">
            {m.material.name}: {formatQty(m.used, m.material.unit)}
            {m.expected !== null && ` of ${formatQty(m.expected, m.material.unit)}`}
          </span>
          <span className="shrink-0 text-right">
            <WasteText line={m} />
            {m.value !== null && Number(m.value) !== 0 && (
              <span className="text-muted"> · {formatINR(Math.abs(Number(m.value)))}</span>
            )}
          </span>
        </p>
      ))}
    </div>
  );
}

/**
 * A product's production days, latest first: how much was made and the raw materials used vs. the
 * recipe. Used on the product page and in Wastage → By product.
 */
export function ProductWastageHistory({ product, limit }: { product: Product; limit?: number }) {
  const { data } = useSWR<ProductWastage>(`/stock/production/wastage?productId=${product.id}`);
  if (!data) return <Loading />;
  if (data.days.length === 0) return <p className="text-sm text-muted">No production recorded yet.</p>;
  const total = data.days.reduce((sum, d) => sum + Number(d.wasteValue), 0);
  return (
    <div className="space-y-3">
      {data.totals.length > 0 && (
        <div className="rounded-lg bg-surface-2 p-2 text-sm">
          <p className="mb-1 flex justify-between gap-2 text-xs text-muted">
            <span>
              Last {data.days.length} production day{data.days.length === 1 ? "" : "s"}
            </span>
            <WasteValue value={String(total)} />
          </p>
          {data.totals.map((t) => (
            <Row
              key={t.material.id}
              label={t.material.name}
              value={
                <span>
                  {formatQty(t.used, t.material.unit)} used · <WasteText line={t} />
                </span>
              }
            />
          ))}
        </div>
      )}
      <ul className="divide-y divide-border text-sm">
        {data.days.slice(0, limit).map((day) => (
          <li key={day.date} className="space-y-1 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <Link href={`/production/?date=${day.date}`} className="font-medium hover:text-brand">
                {formatDay(day.date)} ›
              </Link>
              <WasteValue value={day.wasteValue} className="text-xs" />
            </div>
            <p className="text-xs">
              Made <strong>{day.madeStock ? formatStock(product, day.madeStock) : "—"}</strong>
            </p>
            <WasteLines lines={day.materials} />
          </li>
        ))}
      </ul>
    </div>
  );
}
