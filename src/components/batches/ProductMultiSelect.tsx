"use client";

import { useState } from "react";
import { groupProducts, sizeLabel, type Product } from "@/lib/products";
import { Button, Sheet } from "@/components/ui";

const nameOf = (p: Product) => (p.group ? `${p.group.name} ${sizeLabel(p)}` : p.internalName);

/**
 * A dropdown that picks several products: a field showing what's chosen, opening a checklist
 * (sizes under their product, with a tick for all of a product's sizes). The ticks are applied
 * (`onChange`) when the list is closed.
 */
export function ProductMultiSelect({
  products,
  value,
  onChange,
  placeholder,
}: {
  products: Product[];
  value: number[];
  onChange: (ids: number[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  /** Ticks while the list is open */
  const [draft, setDraft] = useState<number[]>(value);
  const chosen = new Set(open ? draft : value);
  const listed = groupProducts(products);
  const set = (ids: number[], on: boolean) => {
    const next = new Set(chosen);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    // Keep the order of the list.
    setDraft(products.filter((p) => next.has(p.id)).map((p) => p.id));
  };
  const picked = products.filter((p) => chosen.has(p.id));
  const show = () => {
    setDraft(value);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    if (draft.join() !== value.join()) onChange(draft);
  };
  const box = "h-5 w-5 shrink-0 accent-brand";

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 text-left text-base outline-none focus:border-brand sm:text-sm"
      >
        <span className={`min-w-0 flex-1 truncate ${picked.length ? "" : "text-muted"}`}>
          {picked.length === 0
            ? placeholder
            : picked.length === 1
              ? nameOf(picked[0])
              : `${picked.length} chosen: ${picked.map((p) => (p.group ? sizeLabel(p) : p.internalName)).join(", ")}`}
        </span>
        <span className="text-muted" aria-hidden>
          ▾
        </span>
      </button>

      <Sheet open={open} title={placeholder.replace(/…$/, "")} onClose={close}>
        <div className="space-y-1">
          {listed.map((l) =>
            l.kind === "group" ? (
              <div key={l.key} className="space-y-0.5">
                <label className="flex min-h-11 items-center gap-3 font-medium">
                  <input
                    type="checkbox"
                    className={box}
                    checked={l.sizes.every((p) => chosen.has(p.id))}
                    onChange={(e) => set(l.sizes.map((p) => p.id), e.target.checked)}
                  />
                  {l.group.name}
                </label>
                {l.sizes.map((p) => (
                  <label key={p.id} className="ml-8 flex min-h-11 items-center gap-3">
                    <input
                      type="checkbox"
                      className={box}
                      checked={chosen.has(p.id)}
                      onChange={(e) => set([p.id], e.target.checked)}
                    />
                    <span>
                      <span className="font-medium text-brand">{sizeLabel(p)}</span>
                      <span className="block text-xs text-muted">{p.pack.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <label key={l.key} className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  className={box}
                  checked={chosen.has(l.product.id)}
                  onChange={(e) => set([l.product.id], e.target.checked)}
                />
                <span>
                  {l.product.internalName}
                  <span className="block text-xs text-muted">{l.product.pack.description}</span>
                </span>
              </label>
            ),
          )}
        </div>
        <Button size="lg" className="mt-4 w-full" onClick={close}>
          Done{picked.length ? ` (${picked.length})` : ""}
        </Button>
      </Sheet>
    </>
  );
}
