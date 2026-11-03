"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { formatDay, formatINR, todayIST } from "@/lib/format";
import { PRODUCT_MOVEMENT_LABEL, formatStock, perUnit, type ProductDetail } from "@/lib/products";
import { formatQty, unitShort, type Unit } from "@/lib/stock";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  ErrorBox,
  Field,
  Input,
  Loading,
  PageHeader,
  Row,
  Segmented,
  Sheet,
} from "@/components/ui";

function AdjustSheet({ product, onClose }: { product: ProductDetail; onClose: () => void }) {
  const { mutate } = useSWRConfig();
  const [mode, setMode] = useState<"count" | "change">("count");
  const [unit, setUnit] = useState<Unit>(product.saleUnit);
  const [value, setValue] = useState("");
  const [direction, setDirection] = useState<"remove" | "add">("remove");
  const [reason, setReason] = useState("Count correction");
  const [date, setDate] = useState(todayIST());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/products/${product.id}/adjustments`, "POST", {
        date,
        reason: reason.trim(),
        unit,
        ...(mode === "count"
          ? { countedQty: Number(value) }
          : { quantity: (direction === "add" ? 1 : -1) * Number(value) }),
      });
      await mutate((k) => typeof k === "string" && k.startsWith("/products"));
      onClose();
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <Sheet open title={`Adjust ready stock · ${product.internalName}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Segmented<"count" | "change">
          value={mode}
          onChange={(m) => {
            setMode(m);
            setReason(m === "count" ? "Count correction" : "Damaged");
          }}
          options={[
            { value: "count", label: "I counted" },
            { value: "change", label: "Add / remove" },
          ]}
        />
        <p className="text-sm text-muted">In the app: {formatStock(product, product.currentQty)}</p>
        {product.pack.units.length > 1 && (
          <Segmented<Unit>
            value={unit}
            onChange={setUnit}
            options={product.pack.units.map((u) => ({ value: u.unit, label: `In ${unitShort(u.unit)}` }))}
          />
        )}
        {mode === "change" && (
          <Segmented<"remove" | "add">
            value={direction}
            onChange={setDirection}
            options={[
              { value: "remove", label: "− Remove" },
              { value: "add", label: "+ Add" },
            ]}
          />
        )}
        <Field label={mode === "count" ? `Actual count (${unitShort(unit)})` : `Quantity (${unitShort(unit)})`}>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            required
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
        <Field label="Reason" hint="e.g. Damaged, Samples given, Count correction">
          <Input required value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Field label="Date">
          <Input type="date" max={todayIST()} required value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <ErrorBox error={error} />
        <Button type="submit" size="lg" className="w-full" disabled={saving || value === ""}>
          {saving ? "Saving…" : "Save adjustment"}
        </Button>
      </form>
    </Sheet>
  );
}

function ProductDetailView() {
  const id = useSearchParams().get("id");
  const { data: p, error, mutate } = useSWR<ProductDetail>(id ? `/products/${id}` : null);
  const [adjusting, setAdjusting] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);

  if (error) return <ErrorBox error={error} />;
  if (!p) return <Loading />;

  const act = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await fn();
      await mutate();
    } catch (e) {
      setActionError(e);
    }
  };

  const raw = p.materials.filter((m) => m.material.type === "RAW");
  const supplies = p.materials.filter((m) => m.material.type === "SUPPLY");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={p.internalName}
        back="/products/"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            On invoices: <strong className="text-foreground">{p.publicName}</strong>
            {p.code && <Badge>{p.code}</Badge>}
            {!p.active && <Badge>Archived</Badge>}
          </span>
        }
        actions={
          <>
            <ButtonLink href={`/products/new/?from=${p.id}`} variant="secondary">
              Duplicate
            </ButtonLink>
            <ButtonLink href={`/products/edit/?id=${p.id}`} variant="secondary">
              Edit
            </ButtonLink>
          </>
        }
      />
      <ErrorBox error={actionError} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-sm text-muted">Ready stock</p>
          <p className={`text-3xl font-semibold tabular-nums ${Number(p.currentQty) <= 0 ? "text-red-600 dark:text-red-400" : ""}`}>
            {formatStock(p, p.currentQty)}
          </p>
          <p className="text-xs text-muted">{p.pack.description}</p>
          <Button variant="secondary" className="mt-3 w-full" onClick={() => setAdjusting(true)}>
            Adjust stock
          </Button>
          <p className="mt-2 text-xs text-muted">Made stock is added from Dashboard → Add production.</p>
        </Card>
        <Card className="p-4 text-sm">
          <Row label={`Price ${perUnit(p.priceUnit ?? p.saleUnit)}`} value={formatINR(p.price)} />
          {p.priceUnit && p.priceUnit !== p.saleUnit && (
            <Row muted label={`= ${perUnit(p.saleUnit)}`} value={formatINR(p.cost.pricePerUnit)} />
          )}
          {p.mrp && <Row muted label="MRP" value={formatINR(p.mrp)} />}
          <Row muted label="GST" value={p.gstRate !== null ? `${Number(p.gstRate)}%` : "—"} />
          <Row muted label="HSN" value={p.hsnCode ?? "—"} />
          <Row muted label="Packing" value={p.pack.description} />
          <div className="mt-2 border-t border-border pt-2">
            <Row
              label="Material cost (est.)"
              value={p.cost.costPerUnit ? formatINR(p.cost.costPerUnit) : "—"}
            />
            {p.cost.margin && <Row label="Margin (est.)" value={formatINR(p.cost.margin)} strong />}
            {p.cost.incomplete && <p className="text-xs text-muted">Some quantities or material prices are missing.</p>}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="mb-2 font-semibold">Materials {perUnit(p.saleUnit)}</h2>
        {p.materials.length === 0 ? (
          <p className="text-sm text-muted">No materials listed yet.</p>
        ) : (
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            {[
              { title: "Ingredients", rows: raw },
              { title: "Packaging & supplies", rows: supplies },
            ].map((g) => (
              <div key={g.title}>
                <p className="mb-1 text-xs font-medium tracking-wide text-muted uppercase">{g.title}</p>
                {g.rows.length === 0 && <p className="text-muted">—</p>}
                {g.rows.map((m) => (
                  <Row
                    key={m.id}
                    label={
                      <Link href={`/stock/detail/?id=${m.materialId}`} className="hover:text-brand">
                        {m.material.name}
                      </Link>
                    }
                    value={
                      m.qtyPerUnit
                        ? `${formatQty(m.qtyPerUnit, m.material.unit)}${m.perPiece ? " per piece" : ""}`
                        : "?"
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </Card>

      {p.specs && p.specs.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 font-semibold">
            Internal specs <span className="text-xs font-normal text-muted">(not on invoices)</span>
          </h2>
          <div className="text-sm">
            {p.specs.map((s) => (
              <Row key={s.key} label={s.key} value={s.value} />
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="mb-2 font-semibold">Stock history</h2>
        {p.movements.length === 0 ? (
          <p className="text-sm text-muted">No stock recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {p.movements.map((mv) => {
              const qty = Number(mv.quantity);
              const deletable = mv.type === "OPENING" || mv.type === "ADJUSTMENT";
              return (
                <li key={mv.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {mv.sale ? (
                        <Link href={`/sales/detail/?id=${mv.sale.id}`} className="hover:text-brand">
                          {PRODUCT_MOVEMENT_LABEL[mv.type]} · {mv.sale.invoiceNumber} ›
                        </Link>
                      ) : mv.type === "PRODUCED" ? (
                        <Link href={`/production/?date=${mv.date}`} className="hover:text-brand">
                          {PRODUCT_MOVEMENT_LABEL[mv.type]} ›
                        </Link>
                      ) : (
                        PRODUCT_MOVEMENT_LABEL[mv.type]
                      )}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {formatDay(mv.date)}
                      {mv.note && ` · ${mv.note}`}
                    </p>
                  </div>
                  <div className="text-right tabular-nums">
                    <p className={qty < 0 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}>
                      {qty > 0 ? "+" : "−"}
                      {formatStock(p, Math.abs(qty))}
                    </p>
                    <p className="text-xs text-muted">= {formatStock(p, mv.balanceAfter)}</p>
                  </div>
                  {deletable ? (
                    <button
                      onClick={() =>
                        confirm("Delete this entry? Stock will be corrected.") &&
                        act(() => api(`/products/movements/${mv.id}`, "DELETE"))
                      }
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

      <div className="flex justify-center pb-4">
        <Button
          variant={p.active ? "ghost" : "secondary"}
          size="sm"
          onClick={() => act(() => api(`/products/${p.id}`, "PATCH", { active: !p.active }))}
        >
          {p.active ? "Archive product (no longer sold)" : "Restore product"}
        </Button>
      </div>

      {adjusting && <AdjustSheet product={p} onClose={() => setAdjusting(false)} />}
    </div>
  );
}

export default function ProductDetailPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ProductDetailView />
    </Suspense>
  );
}
