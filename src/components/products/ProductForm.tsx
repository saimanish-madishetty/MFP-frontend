"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { formatINR, todayIST } from "@/lib/format";
import { GST_RATES, packFor, perUnit, unitFactor, unitSingular, type Product } from "@/lib/products";
import { UNITS, formatQty, unitShort, type MaterialListItem, type Unit } from "@/lib/stock";
import { Button, Card, ErrorBox, Field, Input, Segmented, Select } from "@/components/ui";

type RecipeRow = { materialId: number; qty: string; perPiece: boolean };
type SpecRow = { key: string; value: string };

/** Units a product can be sold as (weights and volumes go in the size). */
const SALE_UNITS = UNITS.filter((u) => !["G", "ML", "METER", "ROLL"].includes(u.value));
const SIZE_UNITS = UNITS.filter((u) => ["G", "KG", "ML", "L"].includes(u.value));

/**
 * Add or edit a product. `template` pre-fills a new product from an existing one ("Duplicate"),
 * with every field copied (names and code too: the backend rejects an unchanged name or code).
 */
export function ProductForm({ product, template }: { product?: Product; template?: Product }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: materials } = useSWR<MaterialListItem[]>("/materials?includeInactive=true");
  const src = product ?? template;

  const [internalName, setInternalName] = useState(src?.internalName ?? "");
  const [publicName, setPublicName] = useState(src?.publicName ?? "");
  const [code, setCode] = useState(src?.code ?? "");
  const [saleUnit, setSaleUnit] = useState<Unit>(src?.saleUnit ?? "PACK");
  const [hasPieces, setHasPieces] = useState(src ? (src.piecesPerUnit ?? 0) > 1 : true);
  const [pieces, setPieces] = useState(src?.piecesPerUnit ? String(src.piecesPerUnit) : "");
  const [packSize, setPackSize] = useState(src?.packSize ? String(Number(src.packSize)) : "");
  const [packUnit, setPackUnit] = useState<Unit>(src?.packUnit ?? "G");
  // Price per unit sold (pack/bag) and per piece/kg; either may be blank (worked out from the other).
  const [price, setPrice] = useState(src?.price ?? "");
  const [piecePrice, setPiecePrice] = useState(src?.piecePrice ?? "");
  const [mrp, setMrp] = useState(src?.mrp ?? "");
  const [hsnCode, setHsnCode] = useState(src?.hsnCode ?? "");
  const [gstRate, setGstRate] = useState(
    src?.gstRate !== null && src?.gstRate !== undefined ? String(Number(src.gstRate)) : "5",
  );
  const [specs, setSpecs] = useState<SpecRow[]>(src?.specs?.length ? src.specs : [{ key: "", value: "" }]);
  const [recipe, setRecipe] = useState<RecipeRow[]>(
    src?.materials.map((m) => ({ materialId: m.materialId, qty: m.qtyPerUnit ?? "", perPiece: m.perPiece })) ?? [],
  );
  const [openingQty, setOpeningQty] = useState("");
  const [openingDate, setOpeningDate] = useState(todayIST());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const piecesPerUnit = hasPieces && saleUnit !== "PCS" && Number(pieces) > 1 ? Math.round(Number(pieces)) : null;
  const size = packSize === "" ? null : Number(packSize);
  const pack = packFor({ saleUnit, piecesPerUnit, packSize: size, packUnit: size ? packUnit : null });
  const packed = { saleUnit, pack };
  const twoUnits = pack.units.length > 1;
  const per = unitFactor(packed, saleUnit); // e.g. 10 pieces per pack, 25 kg per bag
  const round2 = (n: number) => Math.round(n * 100) / 100;
  // A blank price is worked out from the other one, like the backend does.
  const pricePerSaleUnit =
    price !== "" ? Number(price) : twoUnits && piecePrice !== "" ? round2(Number(piecePrice) * per) : null;
  const derivedPiecePrice = price !== "" ? round2(Number(price) / per) : null;

  const byId = new Map(materials?.map((m) => [m.id, m]));
  const used = new Set(recipe.map((r) => r.materialId));
  const available = (materials ?? []).filter((m) => m.active && !used.has(m.id));

  const estimate = recipe.reduce(
    (acc, r) => {
      const m = byId.get(r.materialId);
      if (!m?.lastCostPerUnit || r.qty === "") return { ...acc, missing: true };
      const qty = Number(r.qty) * (r.perPiece && piecesPerUnit ? piecesPerUnit : 1);
      return { ...acc, total: acc.total + qty * Number(m.lastCostPerUnit) };
    },
    { total: 0, missing: false },
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = {
      internalName: internalName.trim(),
      publicName: publicName.trim(),
      code: code.trim() || null,
      saleUnit,
      piecesPerUnit,
      packSize: size,
      packUnit: size ? packUnit : null,
      price: price === "" ? null : Number(price),
      piecePrice: twoUnits && piecePrice !== "" ? Number(piecePrice) : null,
      mrp: mrp === "" ? null : Number(mrp),
      hsnCode: hsnCode.trim() || null,
      gstRate: Number(gstRate),
      specs: specs.filter((s) => s.key.trim()),
      materials: recipe.map((r) => ({
        materialId: r.materialId,
        qtyPerUnit: r.qty === "" ? null : Number(r.qty),
        perPiece: piecesPerUnit !== null && r.perPiece,
      })),
      ...(!product && {
        openingQty: openingQty === "" ? undefined : Number(openingQty),
        openingDate,
      }),
    };
    try {
      const saved = product
        ? await api<Product>(`/products/${product.id}`, "PATCH", body)
        : await api<Product>("/products", "POST", body);
      await mutate((k) => typeof k === "string" && k.startsWith("/products"));
      // Edit returns to the details page it came from; a new record replaces the "new" page.
      if (product) router.back();
      else router.replace(`/products/detail/?id=${saved.id}`);
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  const setRow = (id: number, patch: Partial<RecipeRow>) =>
    setRecipe((p) => p.map((x) => (x.materialId === id ? { ...x, ...patch } : x)));

  const recipeSection = (type: "RAW" | "SUPPLY") => {
    const rows = recipe.filter((r) => byId.get(r.materialId)?.type === type);
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
                  <option value="unit">{perUnit(saleUnit)}</option>
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
    <form onSubmit={submit} className="space-y-4">
      <Card className="space-y-4 p-4">
        <Field label="Product name (for you)" hint="Full details, e.g. Maida Noodles 1.5mm 10×500g">
          <Input required value={internalName} onChange={(e) => setInternalName(e.target.value)} autoFocus={!product} />
        </Field>
        <Field label="Name on invoices" hint="What buyers see, e.g. Mahadeva Noodles. Internal details stay hidden.">
          <Input required value={publicName} onChange={(e) => setPublicName(e.target.value)} />
        </Field>
        <Field label="Code" hint="Optional, e.g. MN-15">
          <Input value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
      </Card>

      <Card className="space-y-4 p-4">
        <div>
          <h2 className="font-semibold">Packing</h2>
          <p className="text-xs text-muted">How one unit you sell is packed. Each packing is its own product.</p>
        </div>
        <Field label="Sold as">
          <Select value={saleUnit} onChange={(e) => setSaleUnit(e.target.value as Unit)}>
            {SALE_UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </Select>
        </Field>
        {saleUnit !== "PCS" && (
          <Segmented<"pieces" | "single">
            value={hasPieces ? "pieces" : "single"}
            onChange={(v) => setHasPieces(v === "pieces")}
            options={[
              { value: "pieces", label: "Pieces inside" },
              { value: "single", label: "Single packing" },
            ]}
          />
        )}
        <div className="grid grid-cols-2 gap-4">
          {hasPieces && saleUnit !== "PCS" && (
            <Field label={`Pieces per ${unitSingular(saleUnit)}`} hint="e.g. 10">
              <Input
                type="number"
                inputMode="numeric"
                min={2}
                step={1}
                required
                value={pieces}
                onChange={(e) => setPieces(e.target.value)}
              />
            </Field>
          )}
          <Field
            label={hasPieces && saleUnit !== "PCS" ? "Each piece" : "Size"}
            hint={hasPieces && saleUnit !== "PCS" ? "e.g. 500 g" : `Optional, e.g. 25 kg per ${unitSingular(saleUnit)}`}
          >
            <div className="flex gap-2">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={packSize}
                onChange={(e) => setPackSize(e.target.value)}
              />
              <Select value={packUnit} onChange={(e) => setPackUnit(e.target.value as Unit)} className="max-w-24">
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
              · sell by {unitSingular(saleUnit)} or by {unitSingular(pack.stockUnit)}
            </span>
          )}
        </p>
      </Card>

      <Card className="space-y-4 p-4">
        <div>
          <h2 className="font-semibold">Price & GST</h2>
          {twoUnits && (
            <p className="text-xs text-muted">
              Fill one or both. A blank price is worked out from the other, e.g. {perUnit(pack.stockUnit)} ={" "}
              {perUnit(saleUnit)} ÷ {formatQty(per)}.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label={`Selling price ${perUnit(saleUnit)} (₹)`}
            hint={
              twoUnits && price === "" && pricePerSaleUnit !== null
                ? `Blank = ${formatINR(pricePerSaleUnit)} (from ${perUnit(pack.stockUnit)} price)`
                : undefined
            }
          >
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              required={!twoUnits || piecePrice === ""}
              placeholder={twoUnits && pricePerSaleUnit !== null && price === "" ? String(pricePerSaleUnit) : undefined}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
          {twoUnits && (
            <Field
              label={`Selling price ${perUnit(pack.stockUnit)} (₹)`}
              hint={
                piecePrice === "" && derivedPiecePrice !== null
                  ? `Blank = ${formatINR(derivedPiecePrice)} (from ${perUnit(saleUnit)} price)`
                  : undefined
              }
            >
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                required={price === ""}
                placeholder={derivedPiecePrice !== null && piecePrice === "" ? String(derivedPiecePrice) : undefined}
                value={piecePrice}
                onChange={(e) => setPiecePrice(e.target.value)}
              />
            </Field>
          )}
          <Field label="MRP (₹)" hint="Optional">
            <Input type="number" inputMode="decimal" min={0} step="0.01" value={mrp} onChange={(e) => setMrp(e.target.value)} />
          </Field>
          <Field label="HSN code" hint="e.g. 1902 for noodles">
            <Input value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} />
          </Field>
          <Field label="GST rate">
            <Select value={gstRate} onChange={(e) => setGstRate(e.target.value)}>
              {GST_RATES.map((r) => (
                <option key={r} value={r}>
                  {r}%
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <div>
          <h2 className="font-semibold">Materials used {perUnit(saleUnit)}</h2>
          <p className="text-xs text-muted">
            Quantities can be filled in later. Used for cost estimates.
            {piecesPerUnit !== null && " Choose per piece for things like pouches, per pack for the outer bag."}
          </p>
        </div>
        {recipeSection("RAW")}
        {recipeSection("SUPPLY")}
        {recipe.length > 0 && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
            Estimated material cost {perUnit(saleUnit)}: <strong>{formatINR(Math.round(estimate.total * 100) / 100)}</strong>
            {estimate.missing && <span className="text-muted"> (some quantities or prices missing)</span>}
            {pricePerSaleUnit !== null && !estimate.missing && (
              <span className="text-muted">
                {" "}
                · margin {formatINR(Math.round((pricePerSaleUnit - estimate.total) * 100) / 100)}
              </span>
            )}
          </p>
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <div>
          <h2 className="font-semibold">Internal specs</h2>
          <p className="text-xs text-muted">Only for you. Never printed on invoices.</p>
        </div>
        {specs.map((s, i) => (
          <div key={i} className="flex gap-2">
            <Input
              placeholder="e.g. Thickness"
              value={s.key}
              onChange={(e) => setSpecs((p) => p.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))}
            />
            <Input
              placeholder="e.g. 1.5 mm"
              value={s.value}
              onChange={(e) => setSpecs((p) => p.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
            />
            <button
              type="button"
              aria-label="Remove"
              onClick={() => setSpecs((p) => p.filter((_, j) => j !== i))}
              className="rounded p-1 text-muted hover:bg-surface-2"
            >
              ✕
            </button>
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={() => setSpecs((p) => [...p, { key: "", value: "" }])}>
          + Add spec
        </Button>
      </Card>

      {!product && (
        <Card className="space-y-4 p-4">
          <div>
            <h2 className="font-semibold">Ready stock</h2>
            <p className="text-xs text-muted">Finished {unitShort(saleUnit)} you have now. Leave blank if none.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={`Quantity (${unitShort(saleUnit)})`}>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={openingQty}
                onChange={(e) => setOpeningQty(e.target.value)}
              />
            </Field>
            {openingQty !== "" && (
              <Field label="Counted on">
                <Input type="date" max={todayIST()} value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} />
              </Field>
            )}
          </div>
        </Card>
      )}

      <ErrorBox error={error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={saving}>
          {saving ? "Saving…" : product ? "Save changes" : "Add product"}
        </Button>
      </div>
    </form>
  );
}
