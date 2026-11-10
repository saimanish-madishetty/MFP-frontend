"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { ago, STATUS_LABEL, type BatchDetail } from "@/lib/batches";
import { formatDay, formatINR, todayIST } from "@/lib/format";
import { formatStock, type Product } from "@/lib/products";
import { formatQty } from "@/lib/stock";
import { useCanEdit } from "@/lib/use-auth";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  DateStepper,
  ErrorBox,
  Loading,
  PageHeader,
  Row,
  Segmented,
  Sheet,
  Textarea,
} from "@/components/ui";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <p className="border-b border-border bg-surface-2/60 px-3 py-1.5 text-xs font-medium tracking-wide text-muted uppercase">
        {title}
      </p>
      <div className="px-3 py-2 text-sm">{children}</div>
    </Card>
  );
}

function BatchView() {
  const id = useSearchParams().get("id");
  const key = id ? `/batches/${id}` : null;
  const { data: b, error, mutate } = useSWR<BatchDetail>(key);
  const { data: products } = useSWR<Product[]>("/products?includeInactive=true");
  const { mutate: globalMutate } = useSWRConfig();
  const canEdit = useCanEdit();
  const [sheet, setSheet] = useState<"stage" | "cancel" | null>(null);
  const [date, setDate] = useState(todayIST());
  const [lost, setLost] = useState<"lost" | "back">("lost");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);

  if (error) return <ErrorBox error={error} />;
  if (!b) return <Loading />;

  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  const today = todayIST();
  const open = b.status === "OPEN";
  const last = b.stage === b.stages.length - 1;
  const next = b.stages[b.stage + 1]?.name;
  const put = b.materials.filter((m) => !m.atFinish);
  const supplies = b.materials.filter((m) => m.atFinish);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      await mutate();
      globalMutate(
        (k) =>
          typeof k === "string" &&
          k !== key &&
          ["/batch", "/materials", "/stock", "/products"].some((p) => k.startsWith(p)),
      );
      setSheet(null);
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(false);
    }
  };
  const openSheet = (s: "stage" | "cancel") => {
    setDate(today);
    setActionError(null);
    setSheet(s);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-8">
      <PageHeader
        title={`${b.plan.name} · ${b.number}`}
        back="/batches/"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={open ? "brand" : b.status === "FINISHED" ? "green" : "red"}>{STATUS_LABEL[b.status]}</Badge>
            Started {formatDay(b.startDate)}
            {b.endDate && ` · ${b.status === "FINISHED" ? "finished" : "cancelled"} ${formatDay(b.endDate)}`}
          </span>
        }
      />

      {/* Stages */}
      <Card className="p-3">
        <ol className="space-y-1.5">
          {b.stages.map((stage, i) => {
            // Finishing a batch means it was packed: its last stage is done on the finish day.
            const s =
              b.status === "FINISHED" && i === b.stages.length - 1 && !stage.date ? { ...stage, date: b.endDate } : stage;
            const done = s.date !== null && (i < b.stage || !open || i === b.stage);
            const current = open && i === b.stage;
            return (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    current ? "bg-brand text-brand-fg" : done ? "bg-brand/15 text-brand" : "bg-surface-2 text-muted"
                  }`}
                >
                  {done && !current ? "✓" : i + 1}
                </span>
                <span className={`flex-1 ${current ? "font-semibold" : done ? "" : "text-muted"}`}>{s.name}</span>
                <span className="text-xs text-muted tabular-nums">
                  {s.date ? `${formatDay(s.date)}${current ? ` · ${ago(s.date, today)}` : ""}` : "—"}
                </span>
              </li>
            );
          })}
        </ol>
        {open && canEdit && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
            {!last && <Button onClick={() => openSheet("stage")}>Move to {next} ›</Button>}
            <ButtonLink href={`/batches/finish/?id=${b.id}`} variant={last ? "primary" : "secondary"}>
              Finish batch (packed)
            </ButtonLink>
            {b.stage > 0 && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => act(() => api(`/batches/${b.id}/undo-stage`, "POST"))}
              >
                Undo last stage
              </Button>
            )}
          </div>
        )}
        {!sheet && <div className="mt-2"><ErrorBox error={actionError} /></div>}
      </Card>

      <Section title="Raw materials put in">
        {put.length === 0 ? (
          <p className="text-muted">None</p>
        ) : (
          put.map((m) => <Row key={m.materialId} label={m.name} value={formatQty(m.quantity, m.unit)} />)
        )}
        {open && canEdit && (
          <ButtonLink href={`/batches/edit/?id=${b.id}`} variant="ghost" size="sm" className="mt-1 -ml-3">
            Change materials or start date
          </ButtonLink>
        )}
      </Section>

      {b.status === "FINISHED" && (
        <>
          <Section title="Made">
            {b.products.map((m) => {
              const p = productById.get(m.productId);
              return (
                <Row
                  key={m.productId}
                  label={p?.internalName ?? "…"}
                  value={p ? formatStock(p, m.stockQty) : formatQty(m.quantity)}
                />
              );
            })}
          </Section>
          {supplies.length > 0 && (
            <Section title="Packing supplies used">
              {supplies.map((m) => (
                <Row key={m.materialId} label={m.name} value={formatQty(m.quantity, m.unit)} />
              ))}
            </Section>
          )}
          <Section title="Wastage (used vs. recipe)">
            {b.wastage.map((w) => {
              const waste = w.waste === null ? null : Number(w.waste);
              return (
                <div key={w.material.id} className="flex items-baseline justify-between gap-3 py-1">
                  <div className="min-w-0">
                    <p>{w.material.name}</p>
                    <p className="text-xs text-muted">
                      Used {formatQty(w.used, w.material.unit)}
                      {w.expected !== null ? ` · recipe ${formatQty(w.expected, w.material.unit)}` : " · not in the recipes"}
                    </p>
                  </div>
                  {waste !== null && (
                    <span
                      className={`shrink-0 text-right tabular-nums ${
                        waste > 0
                          ? "text-amber-600 dark:text-amber-400"
                          : waste < 0
                            ? "text-green-700 dark:text-green-400"
                            : "text-muted"
                      }`}
                    >
                      {waste === 0 ? "as recipe" : `${waste > 0 ? "waste" : "saved"} ${formatQty(Math.abs(waste), w.material.unit)}`}
                      {w.wastePct !== null && waste !== 0 && ` (${Math.abs(Number(w.wastePct))}%)`}
                      {w.value !== null && waste !== 0 && (
                        <span className="block text-xs">{formatINR(Math.abs(Number(w.value)))}</span>
                      )}
                    </span>
                  )}
                </div>
              );
            })}
          </Section>
          <Section title="Cost">
            <Row
              label="Materials used"
              value={`${formatINR(b.cost.materials)}${b.cost.incomplete ? " +" : ""}`}
            />
            <Row
              label={Number(b.cost.waste) >= 0 ? "Extra over the recipe" : "Saved on the recipe"}
              value={formatINR(Math.abs(Number(b.cost.waste)))}
            />
            <p className="pt-1 text-xs text-muted">
              At the materials&apos; latest prices{b.cost.incomplete && "; some materials have no price yet"}.
            </p>
          </Section>
        </>
      )}

      {b.status === "CANCELLED" && (
        <Section title="Cancelled">
          {b.materialsLost ? "The materials were lost (they stay used)." : "The materials were put back into stock."}
        </Section>
      )}

      {b.notes && (
        <Section title="Notes">
          <p className="whitespace-pre-wrap">{b.notes}</p>
        </Section>
      )}

      {canEdit && open && (
        <Button variant="ghost" className="text-red-600 dark:text-red-400" onClick={() => openSheet("cancel")}>
          Cancel batch…
        </Button>
      )}
      {canEdit && b.status === "FINISHED" && (
        <div className="space-y-2">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              confirm("Reopen this batch? What it made and the supplies used are taken back out of stock.") &&
              act(() => api(`/batches/${b.id}/reopen`, "POST"))
            }
          >
            Reopen batch
          </Button>
          <ErrorBox error={actionError} />
        </div>
      )}

      <Sheet open={sheet === "stage"} title={`Move to ${next}`} onClose={() => setSheet(null)}>
        <div className="space-y-4">
          <p className="text-sm text-muted">The day the batch reached this stage.</p>
          <DateStepper date={date} onChange={setDate} />
          <ErrorBox error={actionError} />
          <Button
            size="lg"
            className="w-full"
            disabled={busy}
            onClick={() => act(() => api(`/batches/${b.id}/next-stage`, "POST", { date }))}
          >
            {busy ? "Saving…" : `Move to ${next}`}
          </Button>
        </div>
      </Sheet>

      <Sheet open={sheet === "cancel"} title="Cancel batch" onClose={() => setSheet(null)}>
        <div className="space-y-4">
          <DateStepper date={date} onChange={setDate} />
          <div className="space-y-1">
            <p className="text-sm font-medium">The raw materials</p>
            <Segmented
              value={lost}
              onChange={setLost}
              options={[
                { value: "lost", label: "Were lost" },
                { value: "back", label: "Go back to stock" },
              ]}
            />
          </div>
          <Textarea placeholder="Why? (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <ErrorBox error={actionError} />
          <Button
            variant="danger"
            size="lg"
            className="w-full"
            disabled={busy}
            onClick={() =>
              act(() =>
                api(`/batches/${b.id}/cancel`, "POST", {
                  date,
                  materialsLost: lost === "lost",
                  reason: reason.trim() || undefined,
                }),
              )
            }
          >
            {busy ? "Saving…" : "Cancel batch"}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

export default function BatchDetailPage() {
  return (
    <Suspense fallback={<Loading />}>
      <BatchView />
    </Suspense>
  );
}
