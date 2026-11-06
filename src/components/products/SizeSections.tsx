"use client";

import { formatINR, todayIST } from "@/lib/format";
import { perUnit, unitSingular } from "@/lib/products";
import { UNITS, formatQty, unitShort, type MaterialListItem, type Unit } from "@/lib/stock";
import { Card, Field, Input, Segmented, Select } from "@/components/ui";
import { draftPacking, type RecipeRow, type SizeDraft } from "./size-draft";

/** Units a product can be sold as (weights and volumes go in the size). */
const SALE_UNITS = UNITS.filter((u) => !["G", "ML", "METER", "ROLL"].includes(u.value));
const SIZE_UNITS = UNITS.filter((u) => ["G", "KG", "ML", "L"].includes(u.value));

/**
 * Packing, Price, Materials used per pack and Ready stock for one product or one size.
 * `cards`: each section in its own card (product form); `tile`: stacked inside a size tile.
 */
export function SizeSections({
  draft: d,
  set,
  materials,
  variant,
  gst,
  opening,
}: {
  draft: SizeDraft;
  set: (patch: Partial<SizeDraft>) => void;
  materials?: MaterialListItem[];
  variant: "cards" | "tile";
  /** HSN and GST fields, shown with the prices (single product) */
  gst?: React.ReactNode;
  /** Show Ready stock (new products only) */
  opening?: boolean;
}) {
  const { piecesPerUnit, pack, twoUnits, per, pricePerSaleUnit, derivedPiecePrice } = draftPacking(d);
  const withPieces = d.hasPieces && d.saleUnit !== "PCS";

  // Plain functions, not components: a component defined here would remount its inputs on every key.
  const section = (children: React.ReactNode) =>
    variant === "cards" ? (
      <Card className="space-y-4 p-4">{children}</Card>
    ) : (
      <section className="space-y-4 border-t border-border pt-4">{children}</section>
    );
  const title = (children: React.ReactNode) =>
    variant === "cards" ? (
      <h2 className="font-semibold">{children}</h2>
    ) : (
      <h3 className="text-sm font-semibold tracking-wide text-muted uppercase">{children}</h3>
    );

  const byId = new Map(materials?.map((m) => [m.id, m]));
  const used = new Set(d.recipe.map((r) => r.materialId));
  const available = (materials ?? []).filter((m) => m.active && !used.has(m.id));
  const setRecipe = (fn: (rows: RecipeRow[]) => RecipeRow[]) => set({ recipe: fn(d.recipe) });
  const setRow = (id: number, patch: Partial<RecipeRow>) =>
    setRecipe((rows) => rows.map((x) => (x.materialId === id ? { ...x, ...patch } : x)));

  const estimate = d.recipe.reduce(
    (acc, r) => {
      const m = byId.get(r.materialId);
      if (!m?.lastCostPerUnit || r.qty === "") return { ...acc, missing: true };
      const qty = Number(r.qty) * (r.perPiece && piecesPerUnit ? piecesPerUnit : 1);
      return { ...acc, total: acc.total + qty * Number(m.lastCostPerUnit) };
    },
    { total: 0, missing: false }
  );

  const recipeSection = (type: "RAW" | "SUPPLY") => {
    const rows = d.recipe.filter((r) => byId.get(r.materialId)?.type === type);
    const options = available.filter((m) => m.type === type);
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{type === "RAW" ? "Ingredients" : "Packaging & supplies"}</h3>
        {rows.length === 0 && <p className="text-xs text-muted">None added.</p>}
        {rows.map((r) => {
          const m = byId.get(r.materialId)!;
          return (
            <div key={r.materialId} className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm">{m.name}</span>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder="?"
                value={r.qty}
                onChange={(e) => setRow(r.materialId, { qty: e.target.value })}
                className="w-24 text-right"
              />
              <span className="w-12 text-xs text-muted">{unitShort(m.unit)}</span>
              {piecesPerUnit !== null && (
                <Select
                  aria-label="Quantity is per"
                  value={r.perPiece ? "piece" : "unit"}
                  onChange={(e) => setRow(r.materialId, { perPiece: e.target.value === "piece" })}
                  className="w-auto"
                >
                  <option value="unit">{perUnit(d.saleUnit)}</option>
                  <option value="piece">per piece</option>
                </Select>
              )}
              <button
                type="button"
                aria-label="Remove"
                onClick={() => setRecipe((p) => p.filter((x) => x.materialId !== r.materialId))}
                className="rounded p-1 text-muted hover:bg-surface-2"
              >
                ✕
              </button>
            </div>
          );
        })}
        {options.length > 0 && (
          <Select
            value=""
            onChange={(e) =>
              e.target.value &&
              setRecipe((p) => [...p, { materialId: Number(e.target.value), qty: "", perPiece: false }])
            }
          >
            <option value="">+ Add {type === "RAW" ? "ingredient" : "packaging"}…</option>
            {options.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        )}
      </div>
    );
  };

  return (
    <>
      {section(
        <>
          <div>
            {title("Packing")}
            <p className="text-xs text-muted">How one unit you sell is packed.</p>
          </div>
          <Field label="Sold as">
            <Select value={d.saleUnit} onChange={(e) => set({ saleUnit: e.target.value as Unit })}>
              {SALE_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </Select>
          </Field>
          {d.saleUnit !== "PCS" && (
            <Segmented<"pieces" | "single">
              value={d.hasPieces ? "pieces" : "single"}
              onChange={(v) => set({ hasPieces: v === "pieces" })}
              options={[
                { value: "pieces", label: "Pieces inside" },
                { value: "single", label: "Single packing" },
              ]}
            />
          )}
          <div className="grid grid-cols-2 gap-4">
            {withPieces && (
              <Field label={`Pieces per ${unitSingular(d.saleUnit)}`} hint="e.g. 10">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={2}
                  step={1}
                  required
                  value={d.pieces}
                  onChange={(e) => set({ pieces: e.target.value })}
                />
              </Field>
            )}
            <Field
              label={withPieces ? "Each piece" : "Size"}
              hint={withPieces ? "e.g. 500 g" : `Optional, e.g. 25 kg per ${unitSingular(d.saleUnit)}`}
            >
              <div className="flex gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={d.packSize}
                  onChange={(e) => set({ packSize: e.target.value })}
                />
                <Select
                  value={d.packUnit}
                  onChange={(e) => set({ packUnit: e.target.value as Unit })}
                  className="max-w-24"
                >
                  {SIZE_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.short}
                    </option>
                  ))}
                </Select>
              </div>
            </Field>
          </div>
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
            <strong>{pack.description}</strong>
            {pack.units.length > 1 && (
              <span className="text-muted">
                {" "}
                · sell by {unitSingular(d.saleUnit)} or by {unitSingular(pack.stockUnit)}
              </span>
            )}
          </p>
        </>
      )}

      {section(
        <>
          <div>
            {title(gst ? "Price & GST" : "Price")}
            {twoUnits && (
              <p className="text-xs text-muted">
                Fill one or both. A blank price is worked out from the other, e.g. {perUnit(pack.stockUnit)} ={" "}
                {perUnit(d.saleUnit)} ÷ {formatQty(per)}.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={`Selling price ${perUnit(d.saleUnit)} (₹)`}
              hint={
                twoUnits && d.price === "" && pricePerSaleUnit !== null
                  ? `Blank = ${formatINR(pricePerSaleUnit)} (from ${perUnit(pack.stockUnit)} price)`
                  : undefined
              }
            >
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                required={!twoUnits || d.piecePrice === ""}
                placeholder={
                  twoUnits && pricePerSaleUnit !== null && d.price === "" ? String(pricePerSaleUnit) : undefined
                }
                value={d.price}
                onChange={(e) => set({ price: e.target.value })}
              />
            </Field>
            {twoUnits && (
              <Field
                label={`Selling price ${perUnit(pack.stockUnit)} (₹)`}
                hint={
                  d.piecePrice === "" && derivedPiecePrice !== null
                    ? `Blank = ${formatINR(derivedPiecePrice)} (from ${perUnit(d.saleUnit)} price)`
                    : undefined
                }
              >
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  required={d.price === ""}
                  placeholder={
                    derivedPiecePrice !== null && d.piecePrice === "" ? String(derivedPiecePrice) : undefined
                  }
                  value={d.piecePrice}
                  onChange={(e) => set({ piecePrice: e.target.value })}
                />
              </Field>
            )}
            <Field label="MRP (₹)" hint="Optional">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={d.mrp}
                onChange={(e) => set({ mrp: e.target.value })}
              />
            </Field>
            {gst}
          </div>
        </>
      )}

      {section(
        <>
          <div>
            {title(`Materials used ${perUnit(d.saleUnit)}`)}
            <p className="text-xs text-muted">
              Quantities can be filled in later. Used for cost estimates.
              {piecesPerUnit !== null && " Choose per piece for things like pouches, per pack for the outer bag."}
            </p>
          </div>
          {recipeSection("RAW")}
          {recipeSection("SUPPLY")}
          {d.recipe.length > 0 && (
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
              Estimated material cost {perUnit(d.saleUnit)}:{" "}
              <strong>{formatINR(Math.round(estimate.total * 100) / 100)}</strong>
              {estimate.missing && <span className="text-muted"> (some quantities or prices missing)</span>}
              {pricePerSaleUnit !== null && !estimate.missing && (
                <span className="text-muted">
                  {" "}
                  · margin {formatINR(Math.round((pricePerSaleUnit - estimate.total) * 100) / 100)}
                </span>
              )}
            </p>
          )}
        </>
      )}

      {opening &&
        section(
          <>
            <div>
              {title("Ready stock")}
              <p className="text-xs text-muted">Finished {unitShort(d.saleUnit)} you have now. Leave blank if none.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label={`Quantity (${unitShort(d.saleUnit)})`}>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={d.openingQty}
                  onChange={(e) => set({ openingQty: e.target.value })}
                />
              </Field>
              {d.openingQty !== "" && (
                <Field label="Counted on">
                  <Input
                    type="date"
                    max={todayIST()}
                    value={d.openingDate}
                    onChange={(e) => set({ openingDate: e.target.value })}
                  />
                </Field>
              )}
            </div>
          </>
        )}
    </>
  );
}
