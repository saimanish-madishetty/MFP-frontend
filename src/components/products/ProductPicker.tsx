"use client";

import { useState } from "react";
import { groupProducts, sizeLabel, type Product } from "@/lib/products";
import { Select } from "@/components/ui";

/**
 * "+ Add product…" for sales and production. A product with sizes is listed once; choosing it shows
 * its sizes as buttons to tap. Typing a size in the search ("maida 1.5 500") also finds the product.
 */
export function ProductPicker({
  products,
  placeholder,
  onPick,
  detail,
}: {
  /** The products that can be picked */
  products: Product[];
  placeholder: string;
  onPick: (productId: number) => void;
  /** Extra text after a product or size, e.g. its price */
  detail?: (p: Product) => string;
}) {
  const [groupId, setGroupId] = useState<number | null>(null);
  const listed = groupProducts(products);
  const open = listed.find((l) => l.kind === "group" && l.group.id === groupId);

  return (
    <div className="space-y-2">
      <Select
        searchable
        value=""
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return;
          if (v.startsWith("g")) {
            const g = listed.find((l) => l.key === v);
            // A group with one size left to pick needs no second tap.
            if (g?.kind === "group" && g.sizes.length === 1) onPick(g.sizes[0].id);
            else setGroupId(Number(v.slice(1)));
          } else {
            setGroupId(null);
            onPick(Number(v.slice(1)));
          }
        }}
      >
        <option value="">{placeholder}</option>
        {listed.map((l) =>
          l.kind === "single" ? (
            <option key={l.key} value={l.key}>
              {l.product.internalName}
              {detail ? ` · ${detail(l.product)}` : ""}
            </option>
          ) : (
            <option key={l.key} value={l.key}>
              {l.group.name} · {l.sizes.length} size{l.sizes.length === 1 ? "" : "s"}: {l.sizes.map(sizeLabel).join(", ")}
            </option>
          ),
        )}
      </Select>
      {open?.kind === "group" && (
        <div className="rounded-lg border border-brand/40 bg-brand/5 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {open.group.name} <span className="font-normal text-muted">· pick a size</span>
            </p>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setGroupId(null)}
              className="rounded p-1 text-muted hover:bg-surface-2"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {open.sizes.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onPick(p.id);
                  setGroupId(null);
                }}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm hover:border-brand"
              >
                <span className="block font-medium">{sizeLabel(p)}</span>
                {detail && <span className="block text-xs text-muted">{detail(p)}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
