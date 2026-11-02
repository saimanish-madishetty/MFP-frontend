"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import type { Buyer } from "@/lib/buyers";
import { formatINR, todayIST } from "@/lib/format";
import type { Product } from "@/lib/products";
import { previewInvoice, type CompanyProfile, type SaleDetail } from "@/lib/sales";
import { formatQty, unitShort } from "@/lib/stock";
import { PAYMENT_MODES, type PaymentMode } from "@/lib/workers";
import { Button, Card, ErrorBox, Field, Input, Loading, Row, Select, Textarea } from "@/components/ui";

type LineState = { key: number; productId: number; quantity: string; rate: string; discount: string };

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
      quantity: String(Number(l.quantity)),
      rate: String(Number(l.rate)),
      discount: Number(l.discount) > 0 ? String(Number(l.discount)) : "",
    })),
  );
  const [paidNow, setPaidNow] = useState(false);
  const [paidAmount, setPaidAmount] = useState<string | null>(null);
  const [paidMode, setPaidMode] = useState<PaymentMode>("CASH");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (!buyers || !products || !company) return <Loading />;

  const productById = new Map(products.map((p) => [p.id, p]));
  // Archived products already on this invoice still need a name.
  const lineProduct = (id: number) => productById.get(id);
  const originalQty = new Map<number, number>();
  sale?.lines.forEach((l) => originalQty.set(l.productId, (originalQty.get(l.productId) ?? 0) + Number(l.quantity)));

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
  const paidValue = paidAmount ?? String(preview.grandTotal);

  const addLine = (productId: number) => {
    const p = productById.get(productId);
    if (!p) return;
    setLines((prev) => [...prev, { key: nextKey++, productId, quantity: "", rate: String(Number(p.price)), discount: "" }]);
  };
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
      lines: lines.map((l) => ({
        productId: l.productId,
        quantity: Number(l.quantity),
        rate: Number(l.rate),
        discount: l.discount === "" ? undefined : Number(l.discount),
      })),
      ...(!sale && paidNow && Number(paidValue) > 0 && { paidNow: { amount: Number(paidValue), mode: paidMode } }),
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
          const unit = p?.saleUnit ?? sale?.lines.find((x) => x.productId === l.productId)?.unit ?? "PCS";
          const available = (p ? Number(p.currentQty) : 0) + (originalQty.get(l.productId) ?? 0);
          const wanted = lines.filter((x) => x.productId === l.productId).reduce((a, x) => a + (Number(x.quantity) || 0), 0);
          return (
            <div key={l.key} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{name}</p>
                  {p && <p className="truncate text-xs text-muted">Invoice shows: {p.publicName}</p>}
                </div>
                <button
                  type="button"
                  aria-label="Remove item"
                  onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                  className="rounded p-1 text-muted hover:bg-surface-2"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label={`Qty (${unitShort(unit)})`}>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    required
                    value={l.quantity}
                    onChange={(e) => update(l.key, { quantity: e.target.value })}
                  />
                </Field>
                <Field label="Rate (₹)">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    required
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
              <div className="flex items-center justify-between text-xs">
                <span className={wanted > available ? "text-amber-600 dark:text-amber-400" : "text-muted"}>
                  {wanted > available
                    ? `Only ${formatQty(available, unit)} ready. You can still save.`
                    : `${formatQty(available, unit)} ready`}
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
                {p.internalName} · {formatINR(p.price)}
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
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={paidNow} onChange={(e) => setPaidNow(e.target.checked)} />
            Payment received now
          </label>
          {paidNow && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (₹)">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={paidValue}
                  onChange={(e) => setPaidAmount(e.target.value)}
                />
              </Field>
              <Field label="Received by">
                <Select value={paidMode} onChange={(e) => setPaidMode(e.target.value as PaymentMode)}>
                  {PAYMENT_MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
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
                  · {lines.length} item{lines.length === 1 ? "" : "s"}
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
