"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { whatsappLink } from "@/lib/buyers";
import { formatDay, formatINR, todayIST } from "@/lib/format";
import { invoiceFileName, invoicePdf } from "@/lib/invoice-pdf";
import { amountInWords, saleStatus, type CompanyProfile, type SaleDetail } from "@/lib/sales";
import { savePdf, sharePdf } from "@/lib/share";
import { formatQty, unitShort } from "@/lib/stock";
import { PAYMENT_MODES, type PaymentMode } from "@/lib/workers";
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
  Select,
  Sheet,
} from "@/components/ui";

const modeLabel = (m: string) => PAYMENT_MODES.find((p) => p.value === m)?.label ?? m;

function messageText(s: SaleDetail, company?: CompanyProfile) {
  const due = Number(s.grandTotal) - Number(s.amountPaid);
  return [
    `Namaste ${s.buyer.contactPerson || s.buyerName},`,
    "",
    `Invoice ${s.invoiceNumber} dated ${formatDay(s.date, { weekday: false })} from ${company?.businessName ?? "us"}.`,
    `Amount: ${formatINR(s.grandTotal)}`,
    due > 0 && Number(s.amountPaid) > 0 ? `Balance: ${formatINR(due)}` : "",
    due > 0 ? `Please pay by ${formatDay(s.dueDate, { weekday: false })}.` : "Paid in full. Thank you!",
    due > 0 && company?.upiId ? `UPI: ${company.upiId}` : "",
    "",
    "Thank you for your business!",
  ]
    .filter((l, i, arr) => l !== "" || (arr[i - 1] !== "" && i > 0))
    .join("\n");
}

function MarkPaidSheet({ sale, onClose }: { sale: SaleDetail; onClose: () => void }) {
  const { mutate } = useSWRConfig();
  const [date, setDate] = useState(todayIST());
  const [mode, setMode] = useState<PaymentMode>("CASH");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const due = Number(sale.grandTotal) - Number(sale.amountPaid);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/sales/${sale.id}/mark-paid`, "POST", { date, mode, reference: reference.trim() || undefined });
      await mutate((k) => typeof k === "string" && (k.startsWith("/sales") || k.startsWith("/buyers")));
      onClose();
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <Sheet open title={`Payment received · ${sale.invoiceNumber}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <p className="text-sm">
          Records <strong>{formatINR(due)}</strong> received from {sale.buyerName}. For a part payment, use{" "}
          <Link href={`/buyers/detail/?id=${sale.buyerId}`} className="text-brand">
            Receive payment
          </Link>{" "}
          on the buyer page.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Received by">
            <Select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)}>
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" max={todayIST()} required value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        {mode !== "CASH" && (
          <Field label={mode === "CHEQUE" ? "Cheque number" : "UTR / reference"}>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
        )}
        <ErrorBox error={error} />
        <Button type="submit" size="lg" className="w-full" disabled={saving}>
          {saving ? "Saving…" : `Mark ${formatINR(due)} as received`}
        </Button>
      </form>
    </Sheet>
  );
}

function CancelSheet({ sale, onClose }: { sale: SaleDetail; onClose: () => void }) {
  const { mutate } = useSWRConfig();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/sales/${sale.id}/cancel`, "POST", { reason: reason.trim() });
      await mutate(
        (k) => typeof k === "string" && (k.startsWith("/sales") || k.startsWith("/buyers") || k.startsWith("/products")),
      );
      onClose();
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <Sheet open title={`Cancel ${sale.invoiceNumber}?`} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>The invoice number is kept and marked Cancelled.</li>
          <li>Its products go back into ready stock.</li>
          {Number(sale.amountPaid) > 0 && (
            <li>{formatINR(sale.amountPaid)} already paid stays with the buyer as credit for other dues.</li>
          )}
        </ul>
        <Field label="Reason">
          <Input required autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Order cancelled" />
        </Field>
        <ErrorBox error={error} />
        <Button type="submit" variant="danger" size="lg" className="w-full" disabled={saving || !reason.trim()}>
          {saving ? "Cancelling…" : "Cancel invoice"}
        </Button>
      </form>
    </Sheet>
  );
}

function SaleDetailView() {
  const id = useSearchParams().get("id");
  const { data: s, error } = useSWR<SaleDetail>(id ? `/sales/${id}` : null);
  const { data: company } = useSWR<CompanyProfile>("/settings/company");
  const [sheet, setSheet] = useState<"paid" | "cancel" | null>(null);
  const [pdfBusy, setPdfBusy] = useState<"share" | "download" | null>(null);
  const [pdfError, setPdfError] = useState<unknown>(null);
  const [pdfSaved, setPdfSaved] = useState<string | null>(null);

  if (error) return <ErrorBox error={error} />;
  if (!s || !company) return <Loading />;

  const st = saleStatus(s);
  const due = Number(s.grandTotal) - Number(s.amountPaid);
  const taxed = s.type === "TAX_INVOICE";
  const wa = whatsappLink(s.buyerPhone ?? s.buyer.phone, messageText(s, company));

  const pdfAction = async (action: "share" | "download") => {
    setPdfBusy(action);
    setPdfError(null);
    setPdfSaved(null);
    try {
      const pdf = await invoicePdf(s, company);
      const blob = await pdf.getBlob();
      const fileName = invoiceFileName(s);
      const base64 = await pdf.getBase64();
      if (action === "download") {
        const where = await savePdf({ blob, base64, fileName });
        if (where.startsWith("Saved")) setPdfSaved(where);
      } else await sharePdf({ blob, base64, fileName, text: messageText(s, company) });
    } catch (e) {
      setPdfError(e);
    } finally {
      setPdfBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={s.invoiceNumber}
        back="/sales/"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/buyers/detail/?id=${s.buyerId}`} className="hover:text-brand">
              {s.buyerName}
            </Link>
            · {formatDay(s.date)}
            <Badge tone={st.tone}>{st.label}</Badge>
          </span>
        }
        actions={
          !s.cancelledAt && (
            <ButtonLink href={`/sales/edit/?id=${s.id}`} variant="secondary">
              Edit
            </ButtonLink>
          )
        }
      />

      {s.cancelledAt && (
        <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm">
          Cancelled{s.cancelReason ? `: ${s.cancelReason}` : ""}. Stock was returned.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button size="lg" onClick={() => pdfAction("share")} disabled={pdfBusy !== null}>
          {pdfBusy === "share" ? "Preparing…" : "Share PDF"}
        </Button>
        {wa ? (
          <ButtonLink href={wa} variant="secondary" size="lg">
            WhatsApp text
          </ButtonLink>
        ) : (
          <Button variant="secondary" size="lg" disabled title="Buyer has no phone number">
            WhatsApp text
          </Button>
        )}
        <Button variant="secondary" size="lg" onClick={() => pdfAction("download")} disabled={pdfBusy !== null}>
          {pdfBusy === "download" ? "Preparing…" : "Download"}
        </Button>
        {!s.cancelledAt && due > 0 ? (
          <Button variant="secondary" size="lg" onClick={() => setSheet("paid")}>
            Mark as paid
          </Button>
        ) : (
          <span />
        )}
      </div>
      <ErrorBox error={pdfError} />
      {pdfSaved && (
        <p className="rounded-lg bg-green-500/15 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          {pdfSaved}. Open it from the Files app.
        </p>
      )}

      {/* Invoice preview (public names only, like the PDF) */}
      <Card className="overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <p className="font-semibold text-brand">{company.businessName}</p>
            <p className="text-xs text-muted">{taxed ? "Tax invoice" : "Bill"}</p>
          </div>
          <div className="text-right text-xs text-muted">
            <p>Date {formatDay(s.date, { weekday: false })}</p>
            <p>Due {formatDay(s.dueDate, { weekday: false })}</p>
          </div>
        </div>
        <div className="border-b border-border p-4 text-sm">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Bill to</p>
          <p className="font-medium">{s.buyerName}</p>
          {s.buyerAddress && <p className="text-muted">{s.buyerAddress}</p>}
          {s.buyerGstin && <p className="text-muted">GSTIN {s.buyerGstin}</p>}
        </div>
        <ul className="divide-y divide-border text-sm">
          {s.lines.map((l) => (
            <li key={l.id} className="flex items-start gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{l.publicName}</p>
                <p className="text-xs text-muted">
                  {l.description && <span className="block">{l.description}</span>}
                  {formatQty(l.quantity)} {unitShort(l.unit)} × {formatINR(l.rate)}
                  {Number(l.discount) > 0 && ` − ${formatINR(l.discount)}`}
                  {taxed && ` · GST ${Number(l.gstRate)}%`}
                  {l.publicName !== l.product.internalName && <span className="block">({l.product.internalName}, only you see this)</span>}
                </p>
              </div>
              <span className="tabular-nums">{formatINR(l.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-border p-4 text-sm">
          <Row muted label={taxed ? "Taxable value" : "Subtotal"} value={formatINR(s.taxableTotal)} />
          {Number(s.cgstTotal) > 0 && <Row muted label="CGST" value={formatINR(s.cgstTotal)} />}
          {Number(s.sgstTotal) > 0 && <Row muted label="SGST" value={formatINR(s.sgstTotal)} />}
          {Number(s.igstTotal) > 0 && <Row muted label="IGST" value={formatINR(s.igstTotal)} />}
          {Number(s.roundOff) !== 0 && <Row muted label="Round off" value={formatINR(s.roundOff)} />}
          <div className="mt-1 border-t border-border pt-2 text-base">
            <Row strong label="Total" value={formatINR(s.grandTotal)} />
          </div>
          <p className="mt-1 text-xs text-muted italic">{amountInWords(Number(s.grandTotal))}</p>
          {Number(s.amountPaid) > 0 && !s.cancelledAt && (
            <>
              <Row label="Paid" value={`− ${formatINR(s.amountPaid)}`} />
              <Row strong label="Balance" value={formatINR(due)} />
            </>
          )}
          {s.notes && <p className="mt-2 text-xs text-muted">{s.notes}</p>}
        </div>
      </Card>

      {s.allocations.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 font-semibold">Payments</h2>
          <ul className="divide-y divide-border text-sm">
            {s.allocations.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2">
                <span>
                  {formatDay(a.payment.date)} · {modeLabel(a.payment.mode)}
                  {a.payment.reference && ` · ${a.payment.reference}`}
                  {Number(a.payment.amount) !== Number(a.amount) && (
                    <span className="text-xs text-muted"> (part of {formatINR(a.payment.amount)})</span>
                  )}
                </span>
                <span className="tabular-nums text-green-700 dark:text-green-400">{formatINR(a.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!s.cancelledAt && (
        <div className="flex justify-center pb-4">
          <Button variant="ghost" size="sm" onClick={() => setSheet("cancel")}>
            Cancel this invoice
          </Button>
        </div>
      )}

      {sheet === "paid" && <MarkPaidSheet sale={s} onClose={() => setSheet(null)} />}
      {sheet === "cancel" && <CancelSheet sale={s} onClose={() => setSheet(null)} />}
    </div>
  );
}

export default function SaleDetailPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SaleDetailView />
    </Suspense>
  );
}
