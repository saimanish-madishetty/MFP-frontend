"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { formatStock, unitFactor, type Product } from "@/lib/products";
import { formatQty, unitShort, type MaterialListItem, type ProductionDay } from "@/lib/stock";
import { Button, ButtonLink, DateStepper, Empty, ErrorBox, Input, Loading, Textarea } from "@/components/ui";

/** Day-end entry: products made and materials used on a date. Keyed by date by the parent. */
export function DayEndEntry({ date, onDateChange }: { date: string; onDateChange: (d: string) => void }) {
  const key = `/stock/production?date=${date}`;
  const { data: day, error: dayError, mutate } = useSWR<ProductionDay>(key);
  const { data: materials, error: matError } = useSWR<MaterialListItem[]>("/materials?includeInactive=true");
  const { data: products } = useSWR<Product[]>("/products?includeInactive=true");
  const { mutate: globalMutate } = useSWRConfig();
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [madeEdits, setMadeEdits] = useState<Record<number, string>>({});
  const [notesEdit, setNotesEdit] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [justSaved, setJustSaved] = useState(false);

  const saved = new Map(day?.entry?.items.map((i) => [i.materialId, i.quantity]));
  const value = (id: number) => edits[id] ?? saved.get(id) ?? "";
  const notes = notesEdit ?? day?.entry?.notes ?? "";
  const savedMade = new Map(day?.entry?.products.map((p) => [p.productId, p.quantity]));
  const made = (id: number) => madeEdits[id] ?? savedMade.get(id) ?? "";
  const productList = (products ?? []).filter((p) => p.active || savedMade.has(p.id));

  // Active materials, plus archived ones already used on this day. Raw first, recently used first.
  const term = search.trim().toLowerCase();
  const list = (materials ?? [])
    .filter((m) => m.active || saved.has(m.id))
    .filter((m) => !term || m.name.toLowerCase().includes(term))
    .sort(
      (a, b) =>
        a.type.localeCompare(b.type) ||
        (b.lastUsedOn ?? "").localeCompare(a.lastUsedOn ?? "") ||
        a.name.localeCompare(b.name),
    );

  const changedIds = Object.keys(edits)
    .map(Number)
    .filter((id) => Number(edits[id] || 0) !== Number(saved.get(id) ?? 0));
  const madeChanged = Object.keys(madeEdits)
    .map(Number)
    .some((id) => Number(madeEdits[id] || 0) !== Number(savedMade.get(id) ?? 0));
  const dirty = changedIds.length > 0 || madeChanged || (notesEdit !== null && notesEdit !== (day?.entry?.notes ?? ""));
  const usedCount = (materials ?? []).filter((m) => Number(value(m.id)) > 0).length;

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    const ids = new Set([...saved.keys(), ...Object.keys(edits).map(Number)]);
    const items = [...ids]
      .map((id) => ({ materialId: id, quantity: Number(value(id) || 0) }))
      .filter((i) => i.quantity > 0);
    const productIds = new Set([...savedMade.keys(), ...Object.keys(madeEdits).map(Number)]);
    const madeItems = [...productIds]
      .map((id) => ({ productId: id, quantity: Number(made(id) || 0) }))
      .filter((p) => p.quantity > 0);
    try {
      await api("/stock/production", "PUT", {
        date,
        notes: notes.trim() || undefined,
        items,
        products: madeItems,
      });
      await mutate();
      setEdits({});
      setMadeEdits({});
      setNotesEdit(null);
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

  const loading = !day || !materials;

  return (
    <div className="space-y-4 pb-24">
      <DateStepper date={date} onChange={onDateChange} />
      <ErrorBox error={dayError ?? matError} />
      {loading && !dayError && !matError && <Loading />}

      {!loading && materials.length === 0 && productList.length === 0 && (
        <Empty>
          Add your products and materials first.{" "}
          <ButtonLink href="/products/new/" variant="ghost" size="sm">
            + Add product
          </ButtonLink>
          <ButtonLink href="/stock/new/" variant="ghost" size="sm">
            + Add material
          </ButtonLink>
        </Empty>
      )}

      {!loading && (materials.length > 0 || productList.length > 0) && (
        <>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">
              {day.entry || dirty ? `${usedCount} material${usedCount === 1 ? "" : "s"} used` : "Not entered yet"}
            </span>
            {justSaved && !dirty && <span className="text-green-600 dark:text-green-400">Saved ✓</span>}
          </div>
          {productList.length > 0 && (
            <div className="rounded-xl border border-border bg-surface">
              <p className="bg-surface-2/60 px-3 py-1.5 text-xs font-medium tracking-wide text-muted uppercase">
                Products made
              </p>
              <ul className="divide-y divide-border">
                {productList.map((p) => {
                  const v = made(p.id);
                  // Made is entered in packs/bags; stock is kept in stock units (pieces, kg).
                  const per = unitFactor(p, p.saleUnit);
                  const ready = Number(p.currentQty) + (Number(v || 0) - Number(savedMade.get(p.id) ?? 0)) * per;
                  return (
                    <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
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
                          value={v}
                          onChange={(e) => setMadeEdits((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          className={`w-24 text-right ${Number(v) > 0 ? "border-green-600" : ""}`}
                        />
                        <span className="w-10 text-sm text-muted">{unitShort(p.saleUnit)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {materials.length > 0 && (
            <>
              <Input placeholder="Search materials…" value={search} onChange={(e) => setSearch(e.target.value)} />

              <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
                {list.map((m, i) => {
                  const v = value(m.id);
                  // Current stock already has this day's saved usage taken out.
                  const after = Number(m.currentQty) + Number(saved.get(m.id) ?? 0) - Number(v || 0);
                  const showHeader = i === 0 || list[i - 1].type !== m.type;
                  return (
                    <li key={m.id}>
                      {showHeader && (
                        <p className="bg-surface-2/60 px-3 py-1.5 text-xs font-medium tracking-wide text-muted uppercase">
                          {m.type === "RAW" ? "Raw materials" : "Supplies"}
                        </p>
                      )}
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{m.name}</p>
                          <p className={`text-xs ${after < 0 ? "text-red-600 dark:text-red-400" : "text-muted"}`}>
                            {Number(v) > 0 ? "Left after: " : "In stock: "}
                            {formatQty(
                              Number(v) > 0 ? after : Number(m.currentQty) + Number(saved.get(m.id) ?? 0),
                              m.unit,
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="any"
                            placeholder="0"
                            value={v}
                            onChange={(e) => setEdits((p) => ({ ...p, [m.id]: e.target.value }))}
                            className={`w-24 text-right ${Number(v) > 0 ? "border-brand" : ""}`}
                          />
                          <span className="w-10 text-sm text-muted">{unitShort(m.unit)}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <Textarea
            placeholder="Notes for the day (optional)"
            value={notes}
            onChange={(e) => setNotesEdit(e.target.value)}
          />
        </>
      )}

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 pt-3 pb-safe-bottom backdrop-blur md:left-60">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="flex-1 text-sm">
              <ErrorBox error={saveError} />
              {!saveError && "Changes not saved"}
            </div>
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => {
                setEdits({});
                setMadeEdits({});
                setNotesEdit(null);
              }}
            >
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
