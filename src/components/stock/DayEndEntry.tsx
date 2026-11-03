"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { formatStock, unitFactor, type Product } from "@/lib/products";
import { formatQty, unitShort, type MaterialListItem, type ProductionDay } from "@/lib/stock";
import { Button, ButtonLink, DateStepper, Empty, ErrorBox, Input, Loading, Select, Textarea } from "@/components/ui";

/** A raw material used for a product. Untouched lines follow the recipe as the quantity made changes. */
type MaterialLine = { materialId: number; used: string; touched: boolean };
type ProductRow = { productId: number; made: string; materials: MaterialLine[] };
type Draft = { products: ProductRow[]; items: Record<number, string>; notes: string };

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** What the recipe says `made` (sale units) should take of a material, or null if unknown. */
function expected(p: Product | undefined, materialId: number, made: string): number | null {
  const line = p?.materials.find((m) => m.materialId === materialId);
  if (!p || !line?.qtyPerUnit || !(Number(made) > 0)) return null;
  const perUnit = Number(line.qtyPerUnit) * (line.perPiece ? (p.piecesPerUnit ?? 1) : 1);
  return round3(perUnit * Number(made));
}

/** The draft as saved on the server for this day. */
function fromSaved(day: ProductionDay): Draft {
  return {
    products: (day.entry?.products ?? []).map((p) => ({
      productId: p.productId,
      made: String(Number(p.quantity)),
      materials: p.materials.map((m) => ({ materialId: m.materialId, used: String(Number(m.quantity)), touched: true })),
    })),
    items: Object.fromEntries((day.entry?.items ?? []).map((i) => [i.materialId, String(Number(i.quantity))])),
    notes: day.entry?.notes ?? "",
  };
}

/**
 * Production for a date: each product made, with the raw materials used for it (compared with its
 * recipe to show wastage), plus supplies and other materials used that day. Keyed by date by the parent.
 */
export function DayEndEntry({ date, onDateChange }: { date: string; onDateChange: (d: string) => void }) {
  const key = `/stock/production?date=${date}`;
  const { data: day, error: dayError, mutate } = useSWR<ProductionDay>(key);
  const { data: materials, error: matError } = useSWR<MaterialListItem[]>("/materials?includeInactive=true");
  const { data: products } = useSWR<Product[]>("/products?includeInactive=true");
  const { mutate: globalMutate } = useSWRConfig();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [justSaved, setJustSaved] = useState(false);

  if (dayError || matError) return <ErrorBox error={dayError ?? matError} />;
  if (!day || !materials || !products) return <Loading />;

  const saved = fromSaved(day);
  const d = draft ?? saved;
  const edit = (fn: (d: Draft) => Draft) => {
    setJustSaved(false);
    setDraft(fn(structuredClone(d)));
  };

  const productById = new Map(products.map((p) => [p.id, p]));
  const materialById = new Map(materials.map((m) => [m.id, m]));
  const savedMade = new Map(saved.products.map((p) => [p.productId, Number(p.made)]));
  const savedItems = (id: number) => Number(saved.items[id] ?? 0);

  /** Quantity a line counts as used: what was typed, or the recipe amount if untouched. */
  const usedOf = (row: ProductRow, line: MaterialLine) =>
    line.touched ? line.used : String(expected(productById.get(row.productId), line.materialId, row.made) ?? "");

  const addProduct = (productId: number) =>
    edit((x) => {
      const p = productById.get(productId);
      const recipe = (p?.materials ?? []).filter((m) => m.material.type === "RAW");
      x.products.push({
        productId,
        made: "",
        materials: recipe.map((m) => ({ materialId: m.materialId, used: "", touched: false })),
      });
      return x;
    });

  const rowIdx = (productId: number) => d.products.findIndex((r) => r.productId === productId);
  const setRow = (productId: number, fn: (r: ProductRow) => void) =>
    edit((x) => {
      fn(x.products[rowIdx(productId)]);
      return x;
    });

  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(saved);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    const body = {
      date,
      notes: d.notes.trim() || undefined,
      items: Object.entries(d.items)
        .map(([id, q]) => ({ materialId: Number(id), quantity: Number(q || 0) }))
        .filter((i) => i.quantity > 0),
      products: d.products
        .filter((r) => Number(r.made) > 0)
        .map((r) => ({
          productId: r.productId,
          quantity: Number(r.made),
          materials: r.materials
            .map((l) => ({ materialId: l.materialId, quantity: Number(usedOf(r, l) || 0) }))
            .filter((m) => m.quantity > 0),
        })),
    };
    try {
      await api("/stock/production", "PUT", body);
      await mutate();
      setDraft(null);
      setJustSaved(true);
      globalMutate(
        (k) =>
          typeof k === "string" && (k.startsWith("/materials") || k.startsWith("/stock") || k.startsWith("/products")),
      );
    } catch (e) {
      setSaveError(e);
    } finally {
      setSaving(false);
    }
  };

  const addable = products.filter((p) => p.active && rowIdx(p.id) === -1);
  const rawMaterials = materials.filter((m) => m.type === "RAW" && m.active);
  // Supplies, plus any other material already entered for the day.
  const general = materials
    .filter((m) => (m.type === "SUPPLY" && m.active) || d.items[m.id] !== undefined)
    .sort((a, b) => a.type.localeCompare(b.type) || (b.lastUsedOn ?? "").localeCompare(a.lastUsedOn ?? ""));
  const otherRaw = rawMaterials.filter((m) => d.items[m.id] === undefined);

  if (products.length === 0 && materials.length === 0) {
    return (
      <div className="space-y-4">
        <DateStepper date={date} onChange={onDateChange} />
        <Empty>
          Add your products and materials first.{" "}
          <ButtonLink href="/products/new/" variant="ghost" size="sm">
            + Add product
          </ButtonLink>
          <ButtonLink href="/stock/new/" variant="ghost" size="sm">
            + Add material
          </ButtonLink>
        </Empty>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <DateStepper date={date} onChange={onDateChange} />
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted">
          {d.products.length === 0 && !day.entry
            ? "Not entered yet"
            : `${d.products.length} product${d.products.length === 1 ? "" : "s"}`}
        </span>
        {justSaved && !dirty && <span className="text-green-600 dark:text-green-400">Saved ✓</span>}
      </div>

      {/* Products made, each with the raw materials used for it */}
      {d.products.map((row) => {
        const p = productById.get(row.productId);
        if (!p) return null;
        const per = unitFactor(p, p.saleUnit);
        const ready = Number(p.currentQty) + (Number(row.made || 0) - (savedMade.get(p.id) ?? 0)) * per;
        const lineIds = new Set(row.materials.map((l) => l.materialId));
        return (
          <div key={row.productId} className="space-y-2 rounded-xl border border-border bg-surface p-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.internalName}</p>
                <p className="text-xs text-muted">
                  {p.pack.description} · ready now: {formatStock(p, ready)}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  placeholder="0"
                  aria-label={`${p.internalName} made`}
                  value={row.made}
                  onChange={(e) => setRow(p.id, (r) => void (r.made = e.target.value))}
                  className={`w-24 text-right ${Number(row.made) > 0 ? "border-green-600" : ""}`}
                />
                <span className="w-12 text-sm text-muted">{unitShort(p.saleUnit)}</span>
              </div>
              <button
                type="button"
                aria-label="Remove product"
                onClick={() => edit((x) => ({ ...x, products: x.products.filter((r) => r.productId !== p.id) }))}
                className="rounded p-1 text-muted hover:bg-surface-2"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5 rounded-lg bg-surface-2/50 p-2">
              <p className="text-xs font-medium tracking-wide text-muted uppercase">Raw materials used</p>
              {row.materials.length === 0 && (
                <p className="text-xs text-muted">None. Add the raw materials used, or fill in the product&apos;s recipe.</p>
              )}
              {row.materials.map((line) => {
                const m = materialById.get(line.materialId);
                const used = usedOf(row, line);
                const exp = expected(p, line.materialId, row.made);
                const waste = exp !== null && used !== "" ? round3(Number(used) - exp) : null;
                return (
                  <div key={line.materialId} className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{m?.name ?? "?"}</p>
                      <p className="text-xs text-muted">
                        {exp === null ? (
                          "Not in recipe"
                        ) : (
                          <>
                            Recipe {formatQty(exp, m?.unit)}
                            {waste !== null && waste !== 0 && (
                              <span
                                className={
                                  waste > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-700 dark:text-green-400"
                                }
                              >
                                {" "}
                                · {waste > 0 ? "waste" : "saved"} {formatQty(Math.abs(waste), m?.unit)}
                                {exp > 0 && ` (${Math.round((Math.abs(waste) / exp) * 1000) / 10}%)`}
                              </span>
                            )}
                          </>
                        )}
                      </p>
                    </div>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      placeholder="0"
                      aria-label={`${m?.name} used`}
                      value={used}
                      onChange={(e) =>
                        setRow(p.id, (r) => {
                          const l = r.materials.find((x) => x.materialId === line.materialId)!;
                          l.used = e.target.value;
                          l.touched = true;
                        })
                      }
                      className={`w-24 text-right ${line.touched ? "border-brand" : ""}`}
                    />
                    <span className="w-10 text-sm text-muted">{m ? unitShort(m.unit) : ""}</span>
                    <button
                      type="button"
                      aria-label="Remove material"
                      onClick={() =>
                        setRow(p.id, (r) => void (r.materials = r.materials.filter((x) => x.materialId !== line.materialId)))
                      }
                      className="rounded p-1 text-muted hover:bg-surface-2"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
              <div className="flex flex-wrap items-center gap-2">
                {rawMaterials.some((m) => !lineIds.has(m.id)) && (
                  <Select
                    value=""
                    className="min-w-0 flex-1"
                    onChange={(e) =>
                      e.target.value &&
                      setRow(p.id, (r) =>
                        r.materials.push({ materialId: Number(e.target.value), used: "", touched: true }),
                      )
                    }
                  >
                    <option value="">+ Add raw material…</option>
                    {rawMaterials
                      .filter((m) => !lineIds.has(m.id))
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                  </Select>
                )}
                {row.materials.some((l) => l.touched) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setRow(p.id, (r) => {
                        // Back to the recipe amounts (lines not in the recipe stay as typed).
                        for (const l of r.materials) if (expected(p, l.materialId, "1") !== null) l.touched = false;
                      })
                    }
                  >
                    Use recipe amounts
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {addable.length > 0 && (
        <Select value="" onChange={(e) => e.target.value && addProduct(Number(e.target.value))}>
          <option value="">+ Add product made…</option>
          {addable.map((p) => (
            <option key={p.id} value={p.id}>
              {p.internalName} · {p.pack.description}
            </option>
          ))}
        </Select>
      )}

      {/* Supplies and other materials used for the day as a whole */}
      {(general.length > 0 || otherRaw.length > 0) && (
        <div className="rounded-xl border border-border bg-surface">
          <p className="bg-surface-2/60 px-3 py-1.5 text-xs font-medium tracking-wide text-muted uppercase">
            Supplies & other materials used today
          </p>
          <ul className="divide-y divide-border">
            {general.map((m) => {
              const v = d.items[m.id] ?? "";
              // Current stock already has this day's saved usage taken out.
              const before = Number(m.currentQty) + savedItems(m.id);
              const after = before - Number(v || 0);
              return (
                <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.name}</p>
                    <p className={`text-xs ${after < 0 ? "text-red-600 dark:text-red-400" : "text-muted"}`}>
                      {Number(v) > 0 ? `Left after: ${formatQty(after, m.unit)}` : `In stock: ${formatQty(before, m.unit)}`}
                    </p>
                  </div>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    placeholder="0"
                    value={v}
                    onChange={(e) => edit((x) => ({ ...x, items: { ...x.items, [m.id]: e.target.value } }))}
                    className={`w-24 text-right ${Number(v) > 0 ? "border-brand" : ""}`}
                  />
                  <span className="w-10 text-sm text-muted">{unitShort(m.unit)}</span>
                </li>
              );
            })}
          </ul>
          {otherRaw.length > 0 && (
            <div className="border-t border-border p-2">
              <Select
                value=""
                onChange={(e) =>
                  e.target.value && edit((x) => ({ ...x, items: { ...x.items, [Number(e.target.value)]: "" } }))
                }
              >
                <option value="">+ Raw material used for no product in particular…</option>
                {otherRaw.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
      )}

      <Textarea
        placeholder="Notes for the day (optional)"
        value={d.notes}
        onChange={(e) => edit((x) => ({ ...x, notes: e.target.value }))}
      />

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 pt-3 pb-safe-bottom backdrop-blur md:left-60">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="flex-1 text-sm">
              <ErrorBox error={saveError} />
              {!saveError && "Changes not saved"}
            </div>
            <Button variant="ghost" disabled={saving} onClick={() => setDraft(null)}>
              Undo
            </Button>
            <Button size="lg" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
