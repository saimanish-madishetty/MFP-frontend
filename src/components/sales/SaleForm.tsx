"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import type { Buyer } from "@/lib/buyers";
import { formatINR, todayIST } from "@/lib/format";
import { formatStock, perUnit, priceFor, unitFactor, type Product } from "@/lib/products";
import { previewInvoice, type CompanyProfile, type SaleDetail } from "@/lib/sales";
import { unitShort, type Unit } from "@/lib/stock";
import { PAYMENT_MODES, type PaymentMode } from "@/lib/workers";
import { Button, Card, ErrorBox, Field, Input, Loading, Row, Select, Textarea } from "@/components/ui";

/** `unit` is what quantity and rate are in: the product's pack/bag, or a piece/kg. */
type LineState = { key: number; productId: number; unit: Unit; quantity: string; rate: string; discount: string };

let nextKey = 1;

export function SaleForm({ sale, initialBuyerId }: { sale?: SaleDetail; initialBuyerId?: number }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: buyers } = useSWR<Buyer[]>("/buyers");
  const { data: products } = useSWR<Product[]>("/products");
  const { data: company } = useSWR<CompanyProfile>("/settings/company");

  const [buyerId, setBuyerId] = useState<number | "">(sale?.buyerId ?? initialBuyerId ?? "");
  const [date, setDate] = useState(sale?.date ?? todayIST());
  const [notes, setNotes] = useState(sale?.notes ?? "");
  const [lines, setLines] = useState<LineState[]>(() =>
    (sale?.lines ?? []).map((l) => ({
      key: nextKey++,
      productId: l.productId,
      unit: l.unit,
      quantity: String(Number(l.quantity)),
      rate: String(Number(l.rate)),
      discount: Number(l.discount) > 0 ? String(Number(l.discount)) : "",
    })),
  );
  // Amount received with the sale: blank = nothing yet, less than the total = part payment.
  const [paidAmount, setPaidAmount] = useState("");
  const [paidMode, setPaidMode] = useState<PaymentMode>("CASH");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // Saved lines get their pack line put back once products load (see below).
  const [arranged, setArranged] = useState(!sale);

  if (!buyers || !products || !company) return <Loading />;

  const productById = new Map(products.map((p) => [p.id, p]));

  const newLine = (p: Product, unit: Unit): LineState => {
    const rate = priceFor(p, unit);
    return { key: nextKey++, productId: p.id, unit, quantity: "", rate: rate === null ? "" : String(rate), discount: "" };
  };

  // An item is a pack line, optionally with a pieces part right below it. A saved pieces-only
  // line gets an empty pack line above it so it shows the same way.
  if (!arranged) {
    setArranged(true);
    setLines((prev) =>
      prev.flatMap((l, i) => {
        const p = productById.get(l.productId);
        const before = prev[i - 1];
        const orphan =
          p && l.unit !== p.saleUnit && !(before?.productId === l.productId && before.unit === p.saleUnit);
        return orphan ? [newLine(p, p.saleUnit), l] : [l];
      }),
    );
  }
  // Archived products already on this invoice still need a name.
  const lineProduct = (id: number) => productById.get(id);
  // Stock (in stock units) this invoice already took; when editing, it counts as available again.
  const originalQty = new Map<number, number>();
  sale?.lines.forEach((l) => originalQty.set(l.productId, (originalQty.get(l.productId) ?? 0) + Number(l.stockQty)));
  const stockOf = (l: LineState) => {
    const p = lineProduct(l.productId);
    return (Number(l.quantity) || 0) * (p ? unitFactor(p, l.unit) : 1);
  };

  const buyer = buyers.find((b) => b.id === buyerId) ?? (sale && sale.buyerId === buyerId ? sale.buyer : undefined);
  const taxed = company.gstin !== null;
  const sameState =
    !buyer?.state || !company.state || buyer.state.trim().toLowerCase() === company.state.trim().toLowerCase();
  const preview = previewInvoice(
    lines.map((l) => ({
      quantity: Number(l.quantity) || 0,
      rate: Number(l.rate) || 0,
      discount: Number(l.discount) || 0,
      gstRate: Number(lineProduct(l.productId)?.gstRate ?? sale?.lines.find((x) => x.productId === l.productId)?.gstRate ?? 0),
    })),
    { taxed, pricesIncludeGst: company.pricesIncludeGst, interState: taxed && !sameState },
  );
  const paid = paidAmount === "" ? 0 : Number(paidAmount);
  const balance = Math.round((preview.grandTotal - paid) * 100) / 100;

  // Starts in packs (bags); "+ Add pcs" adds pieces (kg) below, and packs can be left blank.
  const addLine = (productId: number) => {
    const p = productById.get(productId);
    if (p) setLines((prev) => [...prev, newLine(p, p.saleUnit)]);
  };

  /** For a mix (20 packs + 5 pieces): a line in the product's other unit, right below `l`. */
  const addOtherUnit = (l: LineState) => {
    const p = lineProduct(l.productId);
    const other = p?.pack.units.find((u) => u.unit !== l.unit)?.unit;
    if (!p || !other) return;
    setLines((prev) => {
      const i = prev.findIndex((x) => x.key === l.key);
      return [...prev.slice(0, i + 1), newLine(p, other), ...prev.slice(i + 1)];
    });
  };
  /** A line directly after one for the same product in another unit is shown as part of it. */
  const isMixPart = (i: number) =>
    i > 0 && lines[i - 1].productId === lines[i].productId && lines[i - 1].unit !== lines[i].unit;

  /** The other half of a pack + pieces item, if there is one. */
  const partner = (i: number) => (isMixPart(i) ? lines[i - 1] : isMixPart(i + 1) ? lines[i + 1] : undefined);
  const filled = (l?: LineState) => Number(l?.quantity) > 0;
  const items = lines.filter((_, i) => !isMixPart(i)).length;
  const update = (key: number, patch: Partial<LineState>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = {
      buyerId,
      date,
      notes: notes.trim() || undefined,
      // A blank packs (or pieces) half of an item isn't sent.
      lines: lines.filter(filled).map((l) => ({
        productId: l.productId,
        unit: l.unit,
        quantity: Number(l.quantity),
        rate: Number(l.rate),
        discount: l.discount === "" ? undefined : Number(l.discount),
      })),
      ...(!sale && paid > 0 && { paidNow: { amount: paid, mode: paidMode } }),
    };
    try {
      const saved = sale
        ? await api<SaleDetail>(`/sales/${sale.id}`, "PUT", body)
        : await api<SaleDetail>("/sales", "POST", body);
      await mutate(
        (k) =>
          typeof k === "string" && (k.startsWith("/sales") || k.startsWith("/buyers") || k.startsWith("/products")),
      );
      // Edit returns to the details page it came from; a new record replaces the "new" page.
      if (sale) router.back();
      else router.replace(`/sales/detail/?id=${saved.id}`);
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  const activeBuyers = buyers.filter((b) => b.active || b.id === buyerId);

  return (
    <form onSubmit={submit} className="space-y-4 pb-28">
      <Card className="space-y-4 p-4">
        <Field label="Buyer">
          <Select required value={buyerId} onChange={(e) => setBuyerId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Choose buyer…</option>
            {activeBuyers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.city ? ` · ${b.city}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        {activeBuyers.length === 0 && (
          <p className="text-sm text-muted">
            No buyers yet.{" "}
            <Link href="/buyers/new/" className="text-brand">
              Add a buyer
            </Link>{" "}
            first.
          </p>
        )}
        {buyer && Number(buyer.summary?.balance ?? 0) > 0 && (
          <p className="text-xs text-muted">Already owes {formatINR(buyer.summary.balance)}</p>
        )}
        <Field label="Invoice date">
          <Input type="date" required max={todayIST()} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Items</h2>
        {lines.length === 0 && <p className="text-sm text-muted">Add the products being sold.</p>}
        {lines.map((l, i) => {
          const p = lineProduct(l.productId);
          const name = p?.internalName ?? sale?.lines.find((x) => x.productId === l.productId)?.product.internalName ?? "?";
          // In stock units (pieces, kg, …), summed over every line of this product.
          const available = (p ? Number(p.currentQty) : 0) + (originalQty.get(l.productId) ?? 0);
          const wanted = lines.filter((x) => x.productId === l.productId).reduce((a, x) => a + stockOf(x), 0);
          const part = isMixPart(i);
          const hasPart = i + 1 < lines.length && isMixPart(i + 1);
          const other = p?.pack.units.find((u) => u.unit !== l.unit)?.unit;
          const mate = partner(i);
          // ✕ on the item removes it with its pieces part; ✕ on the pieces part removes just that.
          const gone = new Set([l.key, ...(!part && mate ? [mate.key] : [])]);
          const remove = (
            <button
              type="button"
              aria-label={part ? `Remove ${unitShort(l.unit)}` : "Remove item"}
              onClick={() => setLines((prev) => prev.filter((x) => !gone.has(x.key)))}
              className="rounded p-1 text-muted hover:bg-surface-2"
            >
              ✕
            </button>
          );
          return (
            <div
              key={l.key}
              className={`space-y-2 border border-border p-3 ${
                part ? "-mt-3 rounded-b-lg border-t-0 pt-0" : hasPart ? "rounded-t-lg border-b-0" : "rounded-lg"
              }`}
            >
              {part ? (
                <div className="flex items-center justify-between gap-2 border-t border-dashed border-border pt-2">
                  <p className="text-sm text-muted">+ {unitShort(l.unit)} of {name}</p>
                  {remove}
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{name}</p>
                    {p && (
                      <p className="truncate text-xs text-muted">
                        Invoice shows: {p.publicName} · {p.pack.description}
                      </p>
                    )}
                  </div>
                  {remove}
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <Field label={`Qty (${unitShort(l.unit)})`}>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    // Packs can stay blank when selling only pieces (and the other way round).
                    required={!filled(mate)}
                    placeholder={mate ? "0" : undefined}
                    value={l.quantity}
                    onChange={(e) => update(l.key, { quantity: e.target.value })}
                  />
                </Field>
                <Field label={`Rate ₹ ${perUnit(l.unit)}`}>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    required={filled(l) || !mate}
                    value={l.rate}
                    onChange={(e) => update(l.key, { rate: e.target.value })}
                  />
                </Field>
                <Field label="Discount (₹)">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    placeholder="0"
                    value={l.discount}
                    onChange={(e) => update(l.key, { discount: e.target.value })}
                  />
                </Field>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className={wanted > available ? "text-amber-600 dark:text-amber-400" : "text-muted"}>
                  {!p || hasPart
                    ? ""
                    : wanted > available
                      ? `Only ${formatStock(p, available)} ready. You can still save.`
                      : `${formatStock(p, available)} ready`}
                  {p && other && !part && !hasPart && (
                    <button type="button" onClick={() => addOtherUnit(l)} className="ml-2 font-medium text-brand">
                      + Add {unitShort(other)}
                    </button>
                  )}
                </span>
                <span className="font-medium tabular-nums">{formatINR(preview.lineTotals[i] ?? 0)}</span>
              </div>
            </div>
          );
        })}
        <Select value="" onChange={(e) => e.target.value && addLine(Number(e.target.value))}>
          <option value="">+ Add product…</option>
          {products
            .filter((p) => p.active)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.internalName} · {formatINR(priceFor(p, p.saleUnit) ?? 0)} {perUnit(p.saleUnit)}
              </option>
            ))}
        </Select>
        {products.length === 0 && (
          <p className="text-sm text-muted">
            No products yet.{" "}
            <Link href="/products/new/" className="text-brand">
              Add a product
            </Link>{" "}
            first.
          </p>
        )}
      </Card>

      {lines.length > 0 && (
        <Card className="p-4 text-sm">
          <Row muted label={taxed ? "Taxable value" : "Subtotal"} value={formatINR(preview.taxable)} />
          {preview.cgst > 0 && <Row muted label="CGST" value={formatINR(preview.cgst)} />}
          {preview.sgst > 0 && <Row muted label="SGST" value={formatINR(preview.sgst)} />}
          {preview.igst > 0 && <Row muted label="IGST" value={formatINR(preview.igst)} />}
          {preview.roundOff !== 0 && <Row muted label="Round off" value={formatINR(preview.roundOff)} />}
          <div className="mt-1 border-t border-border pt-2 text-base">
            <Row strong label="Total" value={formatINR(preview.grandTotal)} />
          </div>
          {!taxed && (
            <p className="mt-1 text-xs text-muted">
              No GSTIN in Settings, so this is a plain bill without GST.{" "}
              <Link href="/settings/" className="text-brand">
                Settings
              </Link>
            </p>
          )}
        </Card>
      )}

      {!sale && lines.length > 0 && (
        <Card className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount received now (₹)" hint="Leave blank if not paid yet">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                max={preview.grandTotal}
                step="0.01"
                placeholder="0"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
              />
            </Field>
            <Field label="Received by">
              <Select
                value={paidMode}
                onChange={(e) => setPaidMode(e.target.value as PaymentMode)}
                disabled={paid <= 0}
              >
                {PAYMENT_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p
              className={
                balance < 0
                  ? "text-red-600 dark:text-red-400"
                  : paid > 0 && balance === 0
                    ? "text-green-700 dark:text-green-400"
                    : "text-muted"
              }
            >
              {balance < 0
                ? `More than the invoice total (${formatINR(preview.grandTotal)})`
                : paid <= 0
                  ? `Not paid: ${formatINR(preview.grandTotal)} due`
                  : balance === 0
                    ? "Fully paid"
                    : `Part payment: ${formatINR(balance)} still due`}
            </p>
            <div className="flex gap-2">
              {paid !== preview.grandTotal && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setPaidAmount(String(preview.grandTotal))}
                >
                  Full amount
                </Button>
              )}
              {paidAmount !== "" && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setPaidAmount("")}>
                  Clear
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <Field label="Notes on invoice" hint="Optional, e.g. vehicle number, delivery details">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 pt-3 pb-safe-bottom backdrop-blur md:left-60">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <ErrorBox error={error} />
            {!error && (
              <p className="text-lg font-semibold tabular-nums">
                {formatINR(preview.grandTotal)}{" "}
                <span className="text-sm font-normal text-muted">
                  · {items} item{items === 1 ? "" : "s"}
                </span>
              </p>
            )}
          </div>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={saving || lines.length === 0 || buyerId === ""}>
            {saving ? "Saving…" : sale ? "Save changes" : "Create invoice"}
          </Button>
        </div>
      </div>
    </form>
  );
}
