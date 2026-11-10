"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import type { BatchPlan } from "@/lib/batches";
import type { Product } from "@/lib/products";
import { useCanEdit } from "@/lib/use-auth";
import { PlanForm } from "@/components/batches/PlanForm";
import { Badge, Button, Card, Empty, ErrorBox, Loading, PageHeader, Sheet } from "@/components/ui";

/** Batch plans: the stages a kind of product goes through (e.g. Noodles, Vermicelli), and which products follow each. */
export default function BatchPlansPage() {
  const { data: plans, error, mutate } = useSWR<BatchPlan[]>("/batch-plans");
  const { data: products } = useSWR<Product[]>("/products?includeInactive=true");
  const canEdit = useCanEdit();
  const { mutate: globalMutate } = useSWRConfig();
  // undefined: closed; null: new plan
  const [editing, setEditing] = useState<BatchPlan | null | undefined>(undefined);
  const [actionError, setActionError] = useState<unknown>(null);

  const productName = new Map((products ?? []).map((p) => [p.id, p.internalName]));
  const act = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await fn();
      await mutate();
    } catch (e) {
      setActionError(e);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title="Batch plans"
        back="/batches/"
        subtitle="The stages each kind of product goes through"
        actions={canEdit && <Button onClick={() => setEditing(null)}>+ New plan</Button>}
      />
      <ErrorBox error={error ?? actionError} />
      {!plans ? (
        <Loading />
      ) : plans.length === 0 ? (
        <Empty>
          No batch plans yet. Add one for each kind of product, e.g. <b>Noodles</b>: Mixer → Strands → Boiled →
          Folded → Dried → Packed.
        </Empty>
      ) : (
        plans.map((p) => (
          <Card key={p.id} className={`space-y-2 p-4 ${p.active ? "" : "opacity-60"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">
                  {p.name} {!p.active && <Badge>Archived</Badge>}
                </p>
                <p className="text-sm text-muted">{p.stages.join(" → ")}</p>
              </div>
              {canEdit && (
                <Button variant="secondary" size="sm" onClick={() => setEditing(p)}>
                  Edit
                </Button>
              )}
            </div>
            <p className="text-xs text-muted">
              {p.productIds.length === 0
                ? "No products yet"
                : `${p.productIds.length} product${p.productIds.length === 1 ? "" : "s"}: ${p.productIds
                    .map((id) => productName.get(id))
                    .filter(Boolean)
                    .slice(0, 4)
                    .join(", ")}${p.productIds.length > 4 ? "…" : ""}`}
              {p.openBatches > 0 && ` · ${p.openBatches} in process`}
            </p>
            {canEdit && (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => act(() => api(`/batch-plans/${p.id}`, "PATCH", { active: !p.active }))}
                >
                  {p.active ? "Archive" : "Unarchive"}
                </Button>
                {p.openBatches === 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 dark:text-red-400"
                    onClick={() =>
                      confirm(`Delete the plan "${p.name}"?`) && act(() => api(`/batch-plans/${p.id}`, "DELETE"))
                    }
                  >
                    Delete
                  </Button>
                )}
              </div>
            )}
          </Card>
        ))
      )}

      <Sheet
        open={editing !== undefined}
        title={editing ? `Edit ${editing.name}` : "New batch plan"}
        onClose={() => setEditing(undefined)}
      >
        {plans && products && editing !== undefined && (
          <PlanForm
            key={editing?.id ?? "new"}
            plan={editing}
            plans={plans}
            products={products}
            onDone={() => {
              setEditing(undefined);
              mutate();
              // Products now carry the plan they follow.
              globalMutate((k) => typeof k === "string" && k.startsWith("/products"));
            }}
          />
        )}
      </Sheet>
    </div>
  );
}
