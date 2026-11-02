"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { formatINR, todayIST } from "@/lib/format";
import { formatQty, unitShort, type Material } from "@/lib/stock";
import { Button, ErrorBox, Field, Input, Segmented, Sheet } from "@/components/ui";

const refreshStock = (k: unknown) => typeof k === "string" && (k.startsWith("/materials") || k.startsWith("/stock"));

export function PurchaseSheet({ material, onClose }: { material: Material; onClose: () => void }) {
  const { mutate } = useSWRConfig();
  const { data: suppliers } = useSWR<string[]>("/stock/suppliers");
  const [quantity, setQuantity] = useState("");
  const [costMode, setCostMode] = useState<"unit" | "total">("unit");
  const [cost, setCost] = useState("");
  const [supplier, setSupplier] = useState("");
  const [date, setDate] = useState(todayIST());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const unit = unitShort(material.unit);
  const qty = Number(quantity);
  const costPerUnit =
    cost === "" || qty <= 0 ? undefined : costMode === "unit" ? Number(cost) : Math.round((Number(cost) / qty) * 100) / 100;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/materials/${material.id}/purchases`, "POST", {
        date,
        quantity: qty,
        costPerUnit,
        supplier: supplier.trim() || undefined,
        note: note.trim() || undefined,
      });
      await mutate(refreshStock);
      onClose();
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <Sheet open title={`Add purchase · ${material.name}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Field label={`Quantity bought (${unit})`}>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            required
            autoFocus
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </Field>
        <div className="space-y-2">
          <Segmented<"unit" | "total">
            value={costMode}
            onChange={setCostMode}
            options={[
              { value: "unit", label: `Price per ${unit}` },
              { value: "total", label: "Total bill" },
            ]}
          />
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="₹ (optional)"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
          {costPerUnit !== undefined && costMode === "total" && (
            <p className="text-xs text-muted">
              = {formatINR(costPerUnit)} per {unit}
            </p>
          )}
        </div>
        <Field label="Supplier">
          <Input list="suppliers" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Optional" />
          <datalist id="suppliers">
            {suppliers?.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input type="date" max={todayIST()} required value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Note">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bill no., etc." />
          </Field>
        </div>
        <ErrorBox error={error} />
        <Button type="submit" size="lg" className="w-full" disabled={saving || qty <= 0}>
          {saving ? "Saving…" : qty > 0 ? `Add ${formatQty(qty, material.unit)}` : "Add purchase"}
        </Button>
      </form>
    </Sheet>
  );
}

const REASONS = ["Count correction", "Wastage", "Damaged", "Other"];

export function AdjustSheet({ material, onClose }: { material: Material; onClose: () => void }) {
  const { mutate } = useSWRConfig();
  const [mode, setMode] = useState<"count" | "change">("count");
  const [counted, setCounted] = useState("");
  const [direction, setDirection] = useState<"remove" | "add">("remove");
  const [change, setChange] = useState("");
  const [reason, setReason] = useState(REASONS[0]);
  const [otherReason, setOtherReason] = useState("");
  const [date, setDate] = useState(todayIST());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const current = Number(material.currentQty);
  const delta =
    mode === "count"
      ? counted === ""
        ? null
        : Number(counted) - current
      : change === ""
        ? null
        : (direction === "add" ? 1 : -1) * Number(change);
  const reasonText = reason === "Other" ? otherReason.trim() : reason;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/materials/${material.id}/adjustments`, "POST", {
        date,
        reason: reasonText,
        ...(mode === "count" ? { countedQty: Number(counted) } : { quantity: delta }),
      });
      await mutate(refreshStock);
      onClose();
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <Sheet open title={`Adjust stock · ${material.name}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Segmented<"count" | "change">
          value={mode}
          onChange={(m) => {
            setMode(m);
            if (m === "change" && reason === "Count correction") setReason("Wastage");
            if (m === "count") setReason("Count correction");
          }}
          options={[
            { value: "count", label: "I counted the stock" },
            { value: "change", label: "Add / remove" },
          ]}
        />
        <p className="text-sm text-muted">Stock in the app: {formatQty(current, material.unit)}</p>

        {mode === "count" ? (
          <Field label={`Actual stock counted (${unitShort(material.unit)})`}>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              required
              autoFocus
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
            />
          </Field>
        ) : (
          <div className="space-y-2">
            <Segmented<"remove" | "add">
              value={direction}
              onChange={setDirection}
              options={[
                { value: "remove", label: "− Remove" },
                { value: "add", label: "+ Add" },
              ]}
            />
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              required
              placeholder={unitShort(material.unit)}
              value={change}
              onChange={(e) => setChange(e.target.value)}
            />
          </div>
        )}

        {delta !== null && delta !== 0 && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
            {delta > 0 ? "+" : "−"} {formatQty(Math.abs(delta), material.unit)} → new stock{" "}
            <strong>{formatQty(current + delta, material.unit)}</strong>
          </p>
        )}

        <Field label="Reason">
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  reason === r ? "border-brand bg-brand/15 text-brand" : "border-border"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </Field>
        {reason === "Other" && (
          <Input required placeholder="Reason" value={otherReason} onChange={(e) => setOtherReason(e.target.value)} />
        )}
        <Field label="Date">
          <Input type="date" max={todayIST()} required value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <ErrorBox error={error} />
        <Button type="submit" size="lg" className="w-full" disabled={saving || !delta || !reasonText}>
          {saving ? "Saving…" : "Save adjustment"}
        </Button>
      </form>
    </Sheet>
  );
}
