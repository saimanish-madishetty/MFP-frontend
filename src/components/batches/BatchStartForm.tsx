"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import type { BatchDetail, BatchPlan } from "@/lib/batches";
import { todayIST } from "@/lib/format";
import { formatQty, unitShort, type MaterialListItem } from "@/lib/stock";
import { Button, DateStepper, Empty, ErrorBox, Field, Input, Loading, Select, Textarea } from "@/components/ui";

type Line = { materialId: number; qty: string };

/**
 * Start a batch: the plan it follows, the day, and the raw materials put in (they come out of stock
 * that day). With `batch`, edits an open batch instead.
 */
export function BatchStartForm({ batch }: { batch?: BatchDetail }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: plans, error: plansError } = useSWR<BatchPlan[]>("/batch-plans");
  const { data: materials, error: matError } = useSWR<MaterialListItem[]>("/materials?includeInactive=true");
  const [planId, setPlanId] = useState<number | null>(batch?.plan.id ?? null);
  const [date, setDate] = useState(batch?.startDate ?? todayIST());
  const [lines, setLines] = useState<Line[] | null>(
    batch
      ? batch.materials.filter((m) => !m.atFinish).map((m) => ({ materialId: m.materialId, qty: String(Number(m.quantity)) }))
      : null,
  );
  const [notes, setNotes] = useState(batch?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (plansError || matError) return <ErrorBox error={plansError ?? matError} />;
  if (!plans || !materials) return <Loading />;

  const active = plans.filter((p) => p.active);
  if (!batch && active.length === 0)
    return (
      <Empty>
        First add a batch plan: the stages your product goes through.{" "}
        <Link href="/batches/plans/" className="font-medium text-brand">
          Add batch plan ›
        </Link>
      </Empty>
    );

  const plan = plans.find((p) => p.id === (planId ?? (active.length === 1 ? active[0].id : null)));
  const materialById = new Map(materials.map((m) => [m.id, m]));
  const raw = (id: number) => materialById.get(id)?.type === "RAW" && materialById.get(id)?.active;
  // A new batch starts with the raw materials of the plan's last batch.
  const rows = lines ?? (plan?.lastMaterialIds ?? []).filter(raw).map((id) => ({ materialId: id, qty: "" }));
  const savedQty = (id: number) => Number(batch?.materials.find((m) => !m.atFinish && m.materialId === id)?.quantity ?? 0);
  const addable = materials.filter((m) => m.type === "RAW" && m.active && !rows.some((r) => r.materialId === m.id));
  const set = (fn: (r: Line[]) => Line[]) => setLines(fn(rows.map((r) => ({ ...r }))));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan) return setError(new Error("Choose the batch plan"));
    const used = rows.map((r) => ({ materialId: r.materialId, quantity: Number(r.qty) })).filter((r) => r.quantity > 0);
    if (used.length === 0) return setError(new Error("Enter the raw materials put in"));
    setSaving(true);
    setError(null);
    try {
      const body = { date, materials: used, notes: notes.trim() };
      const saved = batch
        ? await api<BatchDetail>(`/batches/${batch.id}`, "PATCH", body)
        : await api<BatchDetail>("/batches", "POST", { ...body, planId: plan.id, notes: notes.trim() || undefined });
      mutate((k) => typeof k === "string" && (k.startsWith("/batch") || k.startsWith("/materials") || k.startsWith("/stock")));
      router.replace(`/batches/detail/?id=${saved.id}`);
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      {batch ? (
        <p className="text-sm text-muted">
          {batch.number} · {batch.plan.name}
        </p>
      ) : (
        <Field label="Batch plan">
          <Select value={plan ? String(plan.id) : ""} onChange={(e) => setPlanId(Number(e.target.value) || null)}>
            <option value="">Choose…</option>
            {active.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {plan && <p className="-mt-2 text-xs text-muted">{plan.stages.join(" → ")}</p>}

      <div className="space-y-1">
        <p className="text-sm font-medium">Started on</p>
        <DateStepper date={date} onChange={setDate} />
      </div>

      <div className="rounded-xl border border-border bg-surface">
        <p className="bg-surface-2/60 px-3 py-1.5 text-xs font-medium tracking-wide text-muted uppercase">
          Raw materials put in
        </p>
        <ul className="divide-y divide-border">
          {rows.map((r) => {
            const m = materialById.get(r.materialId);
            const before = Number(m?.currentQty ?? 0) + savedQty(r.materialId);
            const after = before - (Number(r.qty) || 0);
            return (
              <li key={r.materialId} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m?.name ?? "?"}</p>
                  <p className={`text-xs ${after < 0 ? "text-red-600 dark:text-red-400" : "text-muted"}`}>
                    {Number(r.qty) > 0 ? `Left after: ${formatQty(after, m?.unit)}` : `In stock: ${formatQty(before, m?.unit)}`}
                  </p>
                </div>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  placeholder="0"
                  aria-label={`${m?.name} put in`}
                  value={r.qty}
                  onChange={(e) => set((x) => x.map((l) => (l.materialId === r.materialId ? { ...l, qty: e.target.value } : l)))}
                  className={`w-24 text-right ${Number(r.qty) > 0 ? "border-brand" : ""}`}
                />
                <span className="w-8 text-sm text-muted">{m ? unitShort(m.unit) : ""}</span>
                <button
                  type="button"
                  aria-label="Remove material"
                  onClick={() => set((x) => x.filter((l) => l.materialId !== r.materialId))}
                  className="rounded p-1 text-muted hover:bg-surface-2"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
        {addable.length > 0 && (
          <div className="border-t border-border p-2">
            <Select
              value=""
              onChange={(e) => e.target.value && set((x) => [...x, { materialId: Number(e.target.value), qty: "" }])}
            >
              <option value="">+ Add raw material…</option>
              {addable.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
      <p className="-mt-2 text-xs text-muted">
        Packing supplies (covers, boxes) are entered when the batch is finished.
      </p>

      <Textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <ErrorBox error={error} />
      <Button type="submit" size="lg" className="w-full" disabled={saving}>
        {saving ? "Saving…" : batch ? "Save changes" : "Start batch"}
      </Button>
    </form>
  );
}
