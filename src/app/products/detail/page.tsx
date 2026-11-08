"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { formatDay, formatINR, todayIST } from "@/lib/format";
import {
  PRODUCT_MOVEMENT_LABEL,
  formatStock,
  perUnit,
  sizeLabel,
  unitFactor,
  type ProductDetail,
} from "@/lib/products";
import { DeleteForever } from "@/components/DeleteForever";
import { formatQty, unitShort } from "@/lib/stock";
import { ProductWastageHistory } from "@/components/stock/Wastage";
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
  // Like production: packs (bags) plus loose pieces (kg) for products counted in two units.
  const [value, setValue] = useState("");
  const [extra, setExtra] = useState("");
  const [direction, setDirection] = useState<"remove" | "add">("remove");
  const [reason, setReason] = useState("Count correction");
  const [date, setDate] = useState(todayIST());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const twoUnits = product.pack.units.length > 1;
  const stockUnit = product.pack.stockUnit;
  // Everything is sent in stock units (pieces, kg) so a mix adds up exactly.
  const entered =
    Math.round(
      ((Number(value) || 0) * unitFactor(product, product.saleUnit) + (twoUnits ? Number(extra) || 0 : 0)) * 1000
    ) / 1000;
  const current = Number(product.currentQty);
  const after = mode === "count" ? entered : current + (direction === "add" ? entered : -entered);
  const blank = value === "" && (!twoUnits || extra === "");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/products/${product.id}/adjustments`, "POST", {
        date,
        reason: reason.trim(),
        unit: twoUnits ? stockUnit : product.saleUnit,
        ...(mode === "count" ? { countedQty: entered } : { quantity: (direction === "add" ? 1 : -1) * entered }),
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
        <div className="grid grid-cols-2 gap-3">
          <Field label={unitShort(product.saleUnit).replace(/^./, (c) => c.toUpperCase())}>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              required={!twoUnits || extra === ""}
              autoFocus
              placeholder={twoUnits ? "0" : undefined}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
          {twoUnits && (
            <Field label={`+ ${unitShort(stockUnit).replace(/^./, (c) => c.toUpperCase())}`}>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder="0"
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
              />
            </Field>
          )}
        </div>
        {!blank && (
          <p className={`text-sm ${after < 0 ? "text-red-600 dark:text-red-400" : "text-muted"}`}>
            {mode === "count" ? (
              <>
                Change: {entered - current >= 0 ? "+" : "−"}
                {formatStock(product, Math.abs(entered - current))}
              </>
            ) : (
              <>After: {formatStock(product, after)}</>
            )}
          </p>
        )}
        <Field label="Reason" hint="e.g. Damaged, Samples given, Count correction">
          <Input required value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Field label="Date">
          <Input type="date" max={todayIST()} required value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <ErrorBox error={error} />
        <Button type="submit" size="lg" className="w-full" disabled={saving || blank}>
          {saving ? "Saving…" : "Save adjustment"}
        </Button>
      </form>
    </Sheet>
  );
}

/** Raw materials used vs. the recipe on each production day (from Add production). */
function WastageCard({ product }: { product: ProductDetail }) {
  return (
    <Card className="p-4">
      <h2 className="font-semibold">Wastage</h2>
      <p className="mb-2 text-xs text-muted">
        Raw materials used beyond the recipe, per production day. All products: Wastage in the menu.
      </p>
      <ProductWastageHistory product={product} limit={15} />
    </Card>
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
        back={p.group ? `/products/group/?id=${p.group.id}` : "/products/"}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {p.group && (
              <>
                Size <strong className="text-foreground">{sizeLabel(p)}</strong> of{" "}
                <Link href={`/products/group/?id=${p.group.id}`} className="text-brand">
                  {p.group.name}
                </Link>
                {" · "}
              </>
            )}
            On invoices: <strong className="text-foreground">{p.publicName}</strong>
            {p.code && <Badge>{p.code}</Badge>}
            {!p.active && <Badge>Archived</Badge>}
          </span>
        }
        actions={
          <>
            {p.group ? (
              <ButtonLink href={`/products/new/?group=${p.group.id}&from=${p.id}`} variant="secondary">
                + Add size
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href={`/products/group/edit/?from=${p.id}`} variant="secondary">
                  Make sizes
                </ButtonLink>
                <ButtonLink href={`/products/new/?from=${p.id}`} variant="secondary">
                  Duplicate
                </ButtonLink>
              </>
            )}
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
          <p
            className={`text-3xl font-semibold tabular-nums ${
              Number(p.currentQty) <= 0 ? "text-red-600 dark:text-red-400" : ""
            }`}
          >
            {formatStock(p, p.currentQty)}
          </p>
          <p className="text-xs text-muted">{p.pack.description}</p>
          <Button variant="secondary" className="mt-3 w-full" onClick={() => setAdjusting(true)}>
            Adjust stock
          </Button>
          <p className="mt-2 text-xs text-muted">Made stock is added from Dashboard → Add production.</p>
        </Card>
        <Card className="p-4 text-sm">
          {p.pack.units.map((u) => (
            <Row
              key={u.unit}
              label={`Price ${perUnit(u.unit)}`}
              value={u.price ? `${formatINR(u.price)}${u.priceSet ? "" : " (worked out)"}` : "—"}
            />
          ))}
          {p.mrp && <Row muted label="MRP" value={formatINR(p.mrp)} />}
          <Row muted label="GST" value={p.gstRate !== null ? `${Number(p.gstRate)}%` : "—"} />
          <Row muted label="HSN" value={p.hsnCode ?? "—"} />
          <Row muted label="Packing" value={p.pack.description} />
          <div className="mt-2 border-t border-border pt-2">
            <Row label="Material cost (est.)" value={p.cost.costPerUnit ? formatINR(p.cost.costPerUnit) : "—"} />
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

      <WastageCard product={p} />

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

      <div className="flex flex-wrap justify-center gap-2 pb-4">
        <Button
          variant={p.active ? "ghost" : "secondary"}
          size="sm"
          onClick={() => act(() => api(`/products/${p.id}`, "PATCH", { active: !p.active }))}
        >
          {p.active ? "Archive product (no longer sold)" : "Restore product"}
        </Button>
        <DeleteForever
          name={p.internalName}
          path={`/products/${p.id}`}
          then="/products/"
          refresh={(k) => k.startsWith("/products") || k.startsWith("/stock")}
        >
          <p>
            This permanently deletes <strong>{p.internalName}</strong> with its stock history and recipe. Raw materials
            already used for it stay in material stock. A product that is on an invoice can&apos;t be deleted.
          </p>
        </DeleteForever>
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
