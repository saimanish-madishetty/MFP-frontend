"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { BatchPlan } from "@/lib/batches";
import { groupProducts, sizeLabel, type Product } from "@/lib/products";
import { Button, ErrorBox, Field, Input } from "@/components/ui";

const EXAMPLE = ["Mixer", "Strands", "Boiled", "Folded", "Dried", "Packed"];

/** Name, stages (in order) and the products made with a batch plan. */
export function PlanForm({
  plan,
  plans,
  products,
  onDone,
}: {
  /** null for a new plan */
  plan: BatchPlan | null;
  plans: BatchPlan[];
  products: Product[];
  onDone: () => void;
}) {
  const [name, setName] = useState(plan?.name ?? "");
  const [stages, setStages] = useState<string[]>(plan?.stages ?? EXAMPLE);
  const [picked, setPicked] = useState(() => new Set(plan?.productIds ?? []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const planName = new Map(plans.map((p) => [p.id, p.name]));
  const listed = groupProducts(products.filter((p) => p.active || picked.has(p.id)));
  const toggle = (ids: number[], on: boolean) =>
    setPicked((s) => {
      const next = new Set(s);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  const move = (i: number, by: number) =>
    setStages((s) => {
      const next = [...s];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      return next;
    });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = { name: name.trim(), stages: stages.map((s) => s.trim()).filter(Boolean), productIds: [...picked] };
    try {
      if (plan) await api(`/batch-plans/${plan.id}`, "PATCH", body);
      else await api("/batch-plans", "POST", body);
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  /** "(in Vermicelli)" for a product that follows another plan: ticking it moves it here. */
  const elsewhere = (p: Product) =>
    p.batchPlanId && p.batchPlanId !== plan?.id && !picked.has(p.id) ? ` (in ${planName.get(p.batchPlanId)})` : "";

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Plan name" hint="e.g. Noodles or Vermicelli">
        <Input required value={name} onChange={(e) => setName(e.target.value)} />
      </Field>

      <div className="space-y-2">
        <p className="text-sm font-medium">Stages, in order</p>
        <ol className="space-y-1.5">
          {stages.map((s, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span className="w-5 text-right text-xs text-muted tabular-nums">{i + 1}.</span>
              <Input
                required
                value={s}
                aria-label={`Stage ${i + 1}`}
                onChange={(e) => setStages((x) => x.map((v, j) => (j === i ? e.target.value : v)))}
              />
              <Button type="button" variant="ghost" size="sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                ↑
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Move down"
                disabled={i === stages.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Remove stage"
                disabled={stages.length === 1}
                onClick={() => setStages((x) => x.filter((_, j) => j !== i))}
              >
                ✕
              </Button>
            </li>
          ))}
        </ol>
        <Button type="button" variant="secondary" size="sm" onClick={() => setStages((x) => [...x, ""])}>
          + Add stage
        </Button>
        {plan && plan.openBatches > 0 && (
          <p className="text-xs text-muted">Batches already started keep the stages they started with.</p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">
          Products made with this plan <span className="font-normal text-muted">({picked.size})</span>
        </p>
        <p className="text-xs text-muted">These are offered when a batch is finished and the packs are entered.</p>
        <div className="max-h-70 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
          {listed.length === 0 && <p className="text-sm text-muted">No products yet.</p>}
          {listed.map((l) =>
            l.kind === "group" ? (
              <div key={`g${l.group.id}`} className="space-y-1">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand"
                    checked={l.sizes.every((p) => picked.has(p.id))}
                    onChange={(e) => toggle(l.sizes.map((p) => p.id), e.target.checked)}
                  />
                  {l.group.name}
                </label>
                {l.sizes.map((p) => (
                  <label key={p.id} className="ml-6 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand"
                      checked={picked.has(p.id)}
                      onChange={(e) => toggle([p.id], e.target.checked)}
                    />
                    {sizeLabel(p)}
                    <span className="text-xs text-muted">{elsewhere(p)}</span>
                  </label>
                ))}
              </div>
            ) : (
              <label key={l.product.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand"
                  checked={picked.has(l.product.id)}
                  onChange={(e) => toggle([l.product.id], e.target.checked)}
                />
                {l.product.internalName}
                <span className="text-xs text-muted">{elsewhere(l.product)}</span>
              </label>
            ),
          )}
        </div>
      </div>

      <ErrorBox error={error} />
      <Button type="submit" size="lg" className="w-full" disabled={saving}>
        {saving ? "Saving…" : plan ? "Save plan" : "Add plan"}
      </Button>
    </form>
  );
}
