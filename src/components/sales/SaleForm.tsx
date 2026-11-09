"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import type { Buyer } from "@/lib/buyers";
import { formatINR, todayIST } from "@/lib/format";
import { formatStock, perUnit, priceFor, sizeLabel, unitFactor, unitSingular, type Product } from "@/lib/products";
import { previewInvoice, type CompanyProfile, type SaleDetail } from "@/lib/sales";
import { unitShort, type Unit } from "@/lib/stock";
import { PAYMENT_MODES, type PaymentMode } from "@/lib/workers";
import { Button, Card, ErrorBox, Field, Input, Loading, Row, Select, Textarea } from "@/components/ui";
import { ProductPicker } from "@/components/products/ProductPicker";

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
    }))
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
    return {
      key: nextKey++,
      productId: p.id,
      unit,
      quantity: "",
      rate: rate === null ? "" : String(rate),
      discount: "",
    };
  };

  /** The product's other unit (pieces for a pack, kg for a bag), if it's sold in two. */
  const otherUnit = (p: Product, unit: Unit) => p.pack.units.find((u) => u.unit !== unit)?.unit;

  // An item of a product sold in two units is a pack line with its pieces line right below it,
  // both always shown (either may stay blank). Saved invoices get the missing half added back.
  if (!arranged) {
    setArranged(true);
    setLines((prev) =>
      prev.flatMap((l, i) => {
        const p = productById.get(l.productId);
        const other = p && otherUnit(p, p.saleUnit);
        if (!p || !other) return [l];
        const before = prev[i - 1];
        const after = prev[i + 1];
        if (l.unit !== p.saleUnit)
          return before?.productId === l.productId && before.unit === p.saleUnit ? [l] : [newLine(p, p.saleUnit), l];
        return after?.productId === l.productId && after.unit !== p.saleUnit ? [l] : [l, newLine(p, other)];
      })
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

  /** A line directly after one for the same product in another unit is the pieces half of that item. */
  const isMixPart = (i: number) =>
    i > 0 && i < lines.length && lines[i - 1].productId === lines[i].productId && lines[i - 1].unit !== lines[i].unit;
  const filled = (l?: LineState) => Number(l?.quantity) > 0;
  // An item has one discount, kept on its pack line; when only pieces are sold it applies to those.
  const priced = lines.map((l, i) => {
    if (isMixPart(i) && !filled(lines[i - 1])) return { ...l, discount: lines[i - 1].discount };
    if (isMixPart(i + 1) && !filled(l)) return { ...l, discount: "" };
    return l;
  });

  const buyer = buyers.find((b) => b.id === buyerId) ?? (sale && sale.buyerId === buyerId ? sale.buyer : undefined);
  const taxed = company.gstin !== null;
  const sameState =
    !buyer?.state || !company.state || buyer.state.trim().toLowerCase() === company.state.trim().toLowerCase();
  const preview = previewInvoice(
    priced.map((l) => ({
      quantity: Number(l.quantity) || 0,
      rate: Number(l.rate) || 0,
      discount: Number(l.discount) || 0,
      gstRate: Number(
        lineProduct(l.productId)?.gstRate ?? sale?.lines.find((x) => x.productId === l.productId)?.gstRate ?? 0
      ),
    })),
    { taxed, pricesIncludeGst: company.pricesIncludeGst, interState: taxed && !sameState }
  );
  const paid = paidAmount === "" ? 0 : Number(paidAmount);
  const balance = Math.round((preview.grandTotal - paid) * 100) / 100;

  // Products sold in two units get both boxes (packs + pieces); either can be left blank.
  // `added`: a size just made with "+ New size", before the product list reloads.
  const addLine = (productId: number, added?: Product) => {
    const p = added ?? productById.get(productId);
    if (!p) return;
    const other = otherUnit(p, p.saleUnit);
    setLines((prev) => [...prev, newLine(p, p.saleUnit), ...(other ? [newLine(p, other)] : [])]);
  };
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
      lines: priced.filter(filled).map((l) => ({
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
        (k) => typeof k === "string" && (k.startsWith("/sales") || k.startsWith("/buyers") || k.startsWith("/products"))
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
          <Select
            required
            searchable
            value={buyerId}
            onChange={(e) => setBuyerId(e.target.value ? Number(e.target.value) : "")}
          >
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
          if (isMixPart(i)) return null;
          const p = lineProduct(l.productId);
          const name =
            p?.internalName ?? sale?.lines.find((x) => x.productId === l.productId)?.product.internalName ?? "?";
          // In stock units (pieces, kg, …), summed over every line of this product.
          const available = (p ? Number(p.currentQty) : 0) + (originalQty.get(l.productId) ?? 0);
          const wanted = lines.filter((x) => x.productId === l.productId).reduce((a, x) => a + stockOf(x), 0);
          const mate = isMixPart(i + 1) ? lines[i + 1] : undefined;
          const total = (preview.lineTotals[i] ?? 0) + (mate ? preview.lineTotals[i + 1] ?? 0 : 0);
          const qtyBox = (x: LineState, required: boolean) => (
            <Field label={unitShort(x.unit).replace(/^./, (c) => c.toUpperCase())}>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                required={required}
                placeholder="0"
                value={x.quantity}
                onChange={(e) => update(x.key, { quantity: e.target.value })}
              />
            </Field>
          );
          const rateBox = (x: LineState) => (
            <Field label={`₹ / ${unitSingular(x.unit)}`}>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                required={filled(x) || !mate}
                value={x.rate}
                onChange={(e) => update(x.key, { rate: e.target.value })}
              />
            </Field>
          );
          return (
            <div key={l.key} className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium break-words">{p?.group ? p.group.name : name}</p>
                  {p?.group && <p className="text-sm font-semibold text-brand">{sizeLabel(p)}</p>}
                  {p && <p className="text-xs text-muted">{p.pack.description}</p>}
                </div>
                <button
                  type="button"
                  aria-label="Remove item"
                  onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key && x.key !== mate?.key))}
                  className="rounded p-1 text-muted hover:bg-surface-2"
                >
                  ✕
                </button>
              </div>
              {/* Packs and pieces side by side, their rates below, like the production screen. */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {qtyBox(l, !filled(mate))}
                {mate ? qtyBox(mate, false) : rateBox(l)}
                {mate && rateBox(l)}
                {mate && rateBox(mate)}
                <Field label="Discount ₹">
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
                  {p &&
                    (wanted > available
                      ? `Only ${formatStock(p, available)} ready. You can still save.`
                      : `${formatStock(p, available)} ready`)}
                </span>
                <span className="text-sm font-semibold tabular-nums">{formatINR(total)}</span>
              </div>
            </div>
          );
        })}
        <ProductPicker
          products={products.filter((p) => p.active)}
          placeholder="+ Add product…"
          onPick={addLine}
          detail={(p) => {
            const price = priceFor(p, p.saleUnit);
            return price === null ? "Price at sale" : `${formatINR(price)} ${perUnit(p.saleUnit)}`;
          }}
        />
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
            <Field label="Received now ₹" hint="Blank if not paid yet">
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
