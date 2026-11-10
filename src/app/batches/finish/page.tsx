"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import type { BatchDetail, BatchPlan } from "@/lib/batches";
import { todayIST } from "@/lib/format";
import { sizeLabel, unitFactor, type Product } from "@/lib/products";
import { formatQty, unitShort, type MaterialListItem, type Unit } from "@/lib/stock";
import { ProductPicker } from "@/components/products/ProductPicker";
import { Button, DateStepper, ErrorBox, Loading, PageHeader, Select, Textarea, Input } from "@/components/ui";

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const twoUnits = (p: Product) => p.pack.units.length > 1;

/** `made` in the sale unit (packs, bags); `extra` in stock units (pieces, kg) on top. */
type Made = { made: string; extra: string };
/** A supply line: follows the recipe until typed in. */
type Supply = { qty: string; touched: boolean };

function stockOf(p: Product, m: Made | undefined): number {
  if (!m) return 0;
  return round3((Number(m.made) || 0) * unitFactor(p, p.saleUnit) + (twoUnits(p) ? Number(m.extra) || 0 : 0));
}

/** What the recipe says `stock` (stock units made) should take of a material, or null if it isn't in it. */
function expected(p: Product, materialId: number, stock: number): number | null {
  const line = p.materials.find((m) => m.materialId === materialId);
  if (!line?.qtyPerUnit || !(stock > 0)) return null;
  const perUnit = Number(line.qtyPerUnit) * (line.perPiece ? (p.piecesPerUnit ?? 1) : 1);
  return (perUnit * stock) / unitFactor(p, p.saleUnit);
}

function FinishBatch() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: b, error } = useSWR<BatchDetail>(id ? `/batches/${id}` : null);
  const { data: plans } = useSWR<BatchPlan[]>("/batch-plans");
  const { data: products } = useSWR<Product[]>("/products?includeInactive=true");
  const { data: materials } = useSWR<MaterialListItem[]>("/materials?includeInactive=true");
  const [date, setDate] = useState(todayIST());
  const [made, setMade] = useState<Record<number, Made>>({});
  /** Products added with "+ Other product" (not in the plan) */
  const [extraIds, setExtraIds] = useState<number[]>([]);
  const [supplies, setSupplies] = useState<Record<number, Supply>>({});
  const [notes, setNotes] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);

  if (error) return <ErrorBox error={error} />;
  if (!b || !plans || !products || !materials) return <Loading />;
  if (b.status !== "OPEN") return <ErrorBox error="This batch isn't in process." />;

  const productById = new Map(products.map((p) => [p.id, p]));
  const materialById = new Map(materials.map((m) => [m.id, m]));
  const plan = plans.find((p) => p.id === b.plan.id);
  const shown = [...(plan?.productIds ?? []), ...extraIds]
    .map((pid) => productById.get(pid))
    .filter((p): p is Product => !!p && (p.active || stockOf(p, made[p.id]) > 0));
  const outputs = shown.map((p) => ({ p, stock: stockOf(p, made[p.id]) })).filter((o) => o.stock > 0);

  /** What the recipes say the packs entered should take of a material (null: in no recipe). */
  const recipeFor = (materialId: number) => {
    const parts = outputs.map((o) => expected(o.p, materialId, o.stock)).filter((x): x is number => x !== null);
    return parts.length ? round3(parts.reduce((t, x) => t + x, 0)) : null;
  };
  // Supplies: those in the recipes of what was made, plus any added by hand.
  const recipeSupplyIds = new Set(
    outputs.flatMap((o) => o.p.materials.filter((m) => m.material.type === "SUPPLY" && m.qtyPerUnit).map((m) => m.materialId)),
  );
  const supplyIds = [...new Set([...recipeSupplyIds, ...Object.keys(supplies).map(Number)])];
  const qtyOf = (mid: number) => {
    const s = supplies[mid];
    return s?.touched ? s.qty : String(recipeFor(mid) ?? "");
  };
  const addable = materials
    .filter((m) => m.active && !supplyIds.includes(m.id))
    .sort((a, c) => c.type.localeCompare(a.type) || a.name.localeCompare(c.name));
  const put = b.materials.filter((m) => !m.atFinish);

  const save = async () => {
    if (outputs.length === 0) return setSaveError(new Error("Enter what was made"));
    setSaving(true);
    setSaveError(null);
    try {
      await api(`/batches/${b.id}/finish`, "POST", {
        date,
        products: outputs.map((o) => ({ productId: o.p.id, stockQty: o.stock })),
        supplies: supplyIds
          .map((mid) => ({ materialId: mid, quantity: Number(qtyOf(mid)) || 0 }))
          .filter((s) => s.quantity > 0),
        ...(notes !== null && { notes: notes.trim() }),
      });
      mutate(
        (k) => typeof k === "string" && ["/batch", "/materials", "/stock", "/products"].some((p) => k.startsWith(p)),
      );
      router.replace(`/batches/detail/?id=${b.id}`);
    } catch (e) {
      setSaveError(e);
      setSaving(false);
    }
  };

  const qtyBox = (p: Product, field: keyof Made, unit: Unit) => (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        placeholder="0"
        aria-label={`${p.internalName} made (${unitShort(unit)})`}
        value={made[p.id]?.[field] ?? ""}
        onChange={(e) =>
          setMade((x) => ({ ...x, [p.id]: { ...(x[p.id] ?? { made: "", extra: "" }), [field]: e.target.value } }))
        }
        className={`w-20 text-right ${Number(made[p.id]?.[field]) > 0 ? "border-green-600" : ""}`}
      />
      <span className="w-10 text-sm text-muted">{unitShort(unit)}</span>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24">
      <PageHeader title="Finish batch" back={`/batches/detail/?id=${b.id}`} subtitle={`${b.plan.name} · ${b.number}`} />

      <div className="space-y-1">
        <p className="text-sm font-medium">Packed on</p>
        <DateStepper date={date} onChange={setDate} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">What was made</p>
        {shown.length === 0 && (
          <p className="text-sm text-muted">No products in the plan &ldquo;{b.plan.name}&rdquo; yet: add them below.</p>
        )}
        {shown.map((p) => (
          <div key={p.id} className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium break-words">{p.group ? p.group.name : p.internalName}</p>
              {p.group && <p className="text-sm font-semibold text-brand">{sizeLabel(p)}</p>}
              <p className="text-xs text-muted">{p.pack.description}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              {qtyBox(p, "made", p.saleUnit)}
              {twoUnits(p) && qtyBox(p, "extra", p.pack.stockUnit)}
            </div>
          </div>
        ))}
        <ProductPicker
          products={products.filter((p) => p.active && !shown.some((s) => s.id === p.id))}
          placeholder="+ Other product…"
          onPick={(pid) => setExtraIds((x) => [...x, pid])}
          detail={(p) => p.pack.description}
        />
      </div>

      {/* Raw materials put in vs. what the recipes say the packs entered should take */}
      {put.length > 0 && (
        <div className="rounded-xl border border-border bg-surface">
          <p className="bg-surface-2/60 px-3 py-1.5 text-xs font-medium tracking-wide text-muted uppercase">
            Raw materials: put in vs. recipe
          </p>
          <ul className="divide-y divide-border text-sm">
            {put.map((m) => {
              const exp = recipeFor(m.materialId);
              const waste = exp === null ? null : round3(Number(m.quantity) - exp);
              return (
                <li key={m.materialId} className="flex items-baseline justify-between gap-3 px-3 py-2">
                  <span>
                    {m.name}
                    <span className="block text-xs text-muted">
                      Put in {formatQty(m.quantity, m.unit)}
                      {exp !== null && ` · recipe ${formatQty(exp, m.unit)}`}
                    </span>
                  </span>
                  {waste !== null && waste !== 0 && (
                    <span
                      className={`text-right text-sm tabular-nums ${
                        waste > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-700 dark:text-green-400"
                      }`}
                    >
                      {waste > 0 ? "waste" : "saved"} {formatQty(Math.abs(waste), m.unit)}
                      {exp! > 0 && ` (${Math.round((Math.abs(waste) / exp!) * 1000) / 10}%)`}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface">
        <p className="bg-surface-2/60 px-3 py-1.5 text-xs font-medium tracking-wide text-muted uppercase">
          Packing supplies used
        </p>
        {supplyIds.length === 0 && (
          <p className="px-3 py-2 text-sm text-muted">Enter what was made: the supplies in its recipe appear here.</p>
        )}
        <ul className="divide-y divide-border">
          {supplyIds.map((mid) => {
            const m = materialById.get(mid);
            const v = qtyOf(mid);
            const exp = recipeFor(mid);
            const after = Number(m?.currentQty ?? 0) - (Number(v) || 0);
            return (
              <li key={mid} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m?.name ?? "?"}</p>
                  <p className="text-xs text-muted">
                    {exp !== null ? `Recipe ${formatQty(exp, m?.unit)}` : "Not in the recipes"}
                    <span className={after < 0 ? "text-red-600 dark:text-red-400" : ""}>
                      {" "}
                      · left after {formatQty(after, m?.unit)}
                    </span>
                  </p>
                </div>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  placeholder="0"
                  aria-label={`${m?.name} used`}
                  value={v}
                  onChange={(e) => setSupplies((x) => ({ ...x, [mid]: { qty: e.target.value, touched: true } }))}
                  className={`w-24 text-right ${supplies[mid]?.touched ? "border-brand" : ""}`}
                />
                <span className="w-10 text-sm text-muted">{m ? unitShort(m.unit) : ""}</span>
              </li>
            );
          })}
        </ul>
        {addable.length > 0 && (
          <div className="border-t border-border p-2">
            <Select
              value=""
              onChange={(e) =>
                e.target.value &&
                setSupplies((x) => ({ ...x, [Number(e.target.value)]: { qty: "", touched: true } }))
              }
            >
              <option value="">+ Add supply or material…</option>
              {addable.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.type === "RAW" ? " (raw)" : ""}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <Textarea
        placeholder="Notes (optional)"
        value={notes ?? b.notes ?? ""}
        onChange={(e) => setNotes(e.target.value)}
      />

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 pt-3 pb-safe-bottom backdrop-blur md:left-60">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex-1 text-sm">
            <ErrorBox error={saveError} />
            {!saveError && (outputs.length ? "Products go into stock on the packed day" : "Enter what was made")}
          </div>
          <Button size="lg" onClick={save} disabled={saving || outputs.length === 0}>
            {saving ? "Saving…" : "Finish batch"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function FinishBatchPage() {
  return (
    <Suspense fallback={<Loading />}>
      <FinishBatch />
    </Suspense>
  );
}
