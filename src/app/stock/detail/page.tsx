"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { formatDay, formatINR } from "@/lib/format";
import { MOVEMENT_LABEL, TYPE_LABEL, formatQty, unitShort, type MaterialDetail } from "@/lib/stock";
import { Badge, Button, ButtonLink, Card, ErrorBox, Loading, PageHeader, Row } from "@/components/ui";
import { StockBadge, qtyTone } from "@/components/stock/StockBadge";
import { AdjustSheet, PurchaseSheet } from "@/components/stock/StockSheets";
import { DeleteForever } from "@/components/DeleteForever";

function MaterialDetailView() {
  const id = useSearchParams().get("id");
  const { data: m, error, mutate } = useSWR<MaterialDetail>(id ? `/materials/${id}` : null);
  const { mutate: globalMutate } = useSWRConfig();
  const [sheet, setSheet] = useState<"purchase" | "adjust" | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  if (error) return <ErrorBox error={error} />;
  if (!m) return <Loading />;

  const refresh = async () => {
    await mutate();
    globalMutate((k) => typeof k === "string" && (k.startsWith("/materials") || k.startsWith("/stock")));
  };

  const setActive = async (active: boolean) => {
    setActionError(null);
    try {
      await api(`/materials/${m.id}`, "PATCH", { active });
      await refresh();
    } catch (e) {
      setActionError(e);
    }
  };

  const deleteMovement = async (movementId: number, label: string) => {
    if (!confirm(`Delete this ${label.toLowerCase()}? Stock will be corrected.`)) return;
    setActionError(null);
    try {
      await api(`/stock/movements/${movementId}`, "DELETE");
      await refresh();
    } catch (e) {
      setActionError(e);
    }
  };

  const value = m.lastCostPerUnit && Number(m.currentQty) > 0 ? Number(m.currentQty) * Number(m.lastCostPerUnit) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={m.name}
        back="/stock/"
        subtitle={
          <span className="flex items-center gap-2">
            {TYPE_LABEL[m.type]} · measured in {unitShort(m.unit)}
            {!m.active && <Badge>Archived</Badge>}
          </span>
        }
        actions={
          <ButtonLink href={`/stock/edit/?id=${m.id}`} variant="secondary">
            Edit
          </ButtonLink>
        }
      />
      <ErrorBox error={actionError} />

      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">In stock</p>
            <p className={`text-3xl font-semibold tabular-nums ${qtyTone(m.status)}`}>
              {formatQty(m.currentQty, m.unit)}
            </p>
          </div>
          <StockBadge status={m.status} />
        </div>
        <div className="mt-3 text-sm">
          {m.lowStockLevel !== null && <Row muted label="Low stock alert at" value={formatQty(m.lowStockLevel, m.unit)} />}
          <Row
            muted
            label="Last cost"
            value={m.lastCostPerUnit ? `${formatINR(m.lastCostPerUnit)} / ${unitShort(m.unit)}` : "—"}
          />
          {value !== null && <Row muted label="Stock value (approx.)" value={formatINR(Math.round(value))} />}
        </div>
        {m.notes && <p className="mt-2 text-sm text-muted">{m.notes}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button size="lg" onClick={() => setSheet("purchase")}>
            + Purchase
          </Button>
          <Button size="lg" variant="secondary" onClick={() => setSheet("adjust")}>
            Adjust
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-2 font-semibold">History</h2>
        {m.movements.length === 0 ? (
          <p className="text-sm text-muted">No stock recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {m.movements.map((mv) => {
              const qty = Number(mv.quantity);
              const details = [
                mv.supplier,
                mv.costPerUnit && `${formatINR(mv.costPerUnit)} / ${unitShort(m.unit)}`,
                mv.note,
              ].filter(Boolean);
              return (
                <li key={mv.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {mv.type === "USAGE" ? (
                        <Link href={`/production/?date=${mv.date}`} className="hover:text-brand">
                          {MOVEMENT_LABEL[mv.type]} ›
                        </Link>
                      ) : (
                        MOVEMENT_LABEL[mv.type]
                      )}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {formatDay(mv.date)}
                      {details.length > 0 && ` · ${details.join(" · ")}`}
                    </p>
                  </div>
                  <div className="text-right tabular-nums">
                    <p className={qty < 0 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}>
                      {qty > 0 ? "+" : "−"}
                      {formatQty(Math.abs(qty))}
                    </p>
                    <p className="text-xs text-muted">= {formatQty(mv.balanceAfter)}</p>
                  </div>
                  {mv.type !== "USAGE" ? (
                    <button
                      onClick={() => deleteMovement(mv.id, MOVEMENT_LABEL[mv.type])}
                      className="rounded p-1 text-muted hover:bg-surface-2"
                      aria-label="Delete entry"
                    >
                      ✕
                    </button>
                  ) : (
                    <span className="w-6" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="flex flex-wrap justify-center gap-2 pb-4">
        {m.active ? (
          <Button variant="ghost" size="sm" onClick={() => setActive(false)}>
            Archive material (no longer used)
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setActive(true)}>
            Restore material
          </Button>
        )}
        <DeleteForever
          name={m.name}
          path={`/materials/${m.id}`}
          then={m.type === "SUPPLY" ? "/stock/?tab=supply" : "/stock/"}
          refresh={(k) => k.startsWith("/materials") || k.startsWith("/stock") || k.startsWith("/products")}
        >
          <p>
            This permanently deletes <strong>{m.name}</strong> with all its purchases, usage and adjustments, and
            removes it from product recipes.
          </p>
        </DeleteForever>
      </div>

      {sheet === "purchase" && <PurchaseSheet material={m} onClose={() => setSheet(null)} />}
      {sheet === "adjust" && <AdjustSheet material={m} onClose={() => setSheet(null)} />}
    </div>
  );
}

export default function MaterialDetailPage() {
  return (
    <Suspense fallback={<Loading />}>
      <MaterialDetailView />
    </Suspense>
  );
}
