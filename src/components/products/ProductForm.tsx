"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { formatINR, todayIST } from "@/lib/format";
import { GST_RATES, type Product } from "@/lib/products";
import { UNITS, unitShort, type MaterialListItem, type Unit } from "@/lib/stock";
import { Button, Card, ErrorBox, Field, Input, Select } from "@/components/ui";

type RecipeRow = { materialId: number; qty: string };
type SpecRow = { key: string; value: string };

export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: materials } = useSWR<MaterialListItem[]>("/materials?includeInactive=true");

  const [internalName, setInternalName] = useState(product?.internalName ?? "");
  const [publicName, setPublicName] = useState(product?.publicName ?? "");
  const [code, setCode] = useState(product?.code ?? "");
  const [packSize, setPackSize] = useState(product?.packSize ?? "");
  const [packUnit, setPackUnit] = useState<Unit | "">(product?.packUnit ?? "G");
  const [saleUnit, setSaleUnit] = useState<Unit>(product?.saleUnit ?? "PACK");
  const [price, setPrice] = useState(product?.price ?? "");
  const [mrp, setMrp] = useState(product?.mrp ?? "");
  const [hsnCode, setHsnCode] = useState(product?.hsnCode ?? "");
  const [gstRate, setGstRate] = useState(product?.gstRate !== null && product?.gstRate !== undefined ? String(Number(product.gstRate)) : "5");
  const [specs, setSpecs] = useState<SpecRow[]>(product?.specs?.length ? product.specs : [{ key: "", value: "" }]);
  const [recipe, setRecipe] = useState<RecipeRow[]>(
    product?.materials.map((m) => ({ materialId: m.materialId, qty: m.qtyPerUnit ?? "" })) ?? [],
  );
  const [openingQty, setOpeningQty] = useState("");
  const [openingDate, setOpeningDate] = useState(todayIST());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const byId = new Map(materials?.map((m) => [m.id, m]));
  const used = new Set(recipe.map((r) => r.materialId));
  const available = (materials ?? []).filter((m) => m.active && !used.has(m.id));

  const estimate = recipe.reduce(
    (acc, r) => {
      const m = byId.get(r.materialId);
      if (!m?.lastCostPerUnit || r.qty === "") return { ...acc, missing: true };
      return { ...acc, total: acc.total + Number(r.qty) * Number(m.lastCostPerUnit) };
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
      packSize: packSize === "" ? null : Number(packSize),
      packUnit: packSize === "" || packUnit === "" ? null : packUnit,
      saleUnit,
      price: Number(price),
      mrp: mrp === "" ? null : Number(mrp),
      hsnCode: hsnCode.trim() || null,
      gstRate: Number(gstRate),
      specs: specs.filter((s) => s.key.trim()),
      materials: recipe.map((r) => ({ materialId: r.materialId, qtyPerUnit: r.qty === "" ? null : Number(r.qty) })),
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
            <div key={r.materialId} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm">{m.name}</span>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder="?"
                value={r.qty}
                onChange={(e) =>
                  setRecipe((p) => p.map((x) => (x.materialId === r.materialId ? { ...x, qty: e.target.value } : x)))
                }
                className="w-24 text-right"
              />
              <span className="w-12 text-xs text-muted">{unitShort(m.unit)}</span>
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
            onChange={(e) => e.target.value && setRecipe((p) => [...p, { materialId: Number(e.target.value), qty: "" }])}
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
        <Field label="Product name (for you)" hint="Full details, e.g. Mahadeva Maida Noodles 1.5mm">
          <Input required value={internalName} onChange={(e) => setInternalName(e.target.value)} autoFocus={!product} />
        </Field>
        <Field label="Name on invoices" hint="What buyers see, e.g. Mahadeva Noodles. Internal details stay hidden.">
          <Input required value={publicName} onChange={(e) => setPublicName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Code" hint="Optional, e.g. MN-15">
            <Input value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Field label="Sold as">
            <Select value={saleUnit} onChange={(e) => setSaleUnit(e.target.value as Unit)}>
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Pack size" hint="Optional, e.g. 500 g per pack">
          <div className="flex gap-2">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={packSize}
              onChange={(e) => setPackSize(e.target.value)}
            />
            <Select value={packUnit} onChange={(e) => setPackUnit(e.target.value as Unit)} className="max-w-36">
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.short}
                </option>
              ))}
            </Select>
          </div>
        </Field>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="font-semibold">Price & GST</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label={`Selling price per ${unitShort(saleUnit)} (₹)`}>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
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
          <h2 className="font-semibold">Materials used per {unitShort(saleUnit)}</h2>
          <p className="text-xs text-muted">Quantities can be filled in later. Used for cost estimates.</p>
        </div>
        {recipeSection("RAW")}
        {recipeSection("SUPPLY")}
        {recipe.length > 0 && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
            Estimated material cost: <strong>{formatINR(Math.round(estimate.total * 100) / 100)}</strong>
            {estimate.missing && <span className="text-muted"> (some quantities or prices missing)</span>}
            {price !== "" && !estimate.missing && (
              <span className="text-muted"> · margin {formatINR(Math.round((Number(price) - estimate.total) * 100) / 100)}</span>
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
