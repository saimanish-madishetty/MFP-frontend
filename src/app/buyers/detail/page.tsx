"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { formatDay, formatINR } from "@/lib/format";
import { phoneDigits, whatsappLink, type BuyerDetail } from "@/lib/buyers";
import { saleStatus, type CompanyProfile } from "@/lib/sales";
import { PAYMENT_MODES } from "@/lib/workers";
import { Badge, Button, ButtonLink, Card, ErrorBox, Loading, PageHeader, Row, Segmented } from "@/components/ui";
import { PaymentSheet } from "@/components/buyers/PaymentSheet";
import { BalanceText } from "@/components/buyers/BalanceText";

const modeLabel = (m: string) => PAYMENT_MODES.find((p) => p.value === m)?.label ?? m;

function statementText(b: BuyerDetail, company?: CompanyProfile) {
  const unpaid = b.timeline.filter((t) => t.kind === "SALE" && !t.cancelled && t.paymentStatus !== "PAID");
  const lines = unpaid.map((t) =>
    t.kind === "SALE"
      ? `• ${t.invoiceNumber} (${formatDay(t.date, { weekday: false })}): ${formatINR(Number(t.amount) - Number(t.amountPaid))}${t.overdue ? " – overdue" : ""}`
      : "",
  );
  const old = Number(b.openingBalance) > 0 ? [`• Old dues: ${formatINR(b.openingBalance)}`] : [];
  return [
    `Namaste ${b.contactPerson || b.name},`,
    "",
    `Pending payment with ${company?.businessName ?? "us"}:`,
    ...old,
    ...lines,
    "",
    `Total due: ${formatINR(b.summary.balance)}`,
    company?.upiId ? `UPI: ${company.upiId}` : "",
    "",
    "Thank you!",
  ]
    .filter((l, i, arr) => l !== "" || arr[i - 1] !== "")
    .join("\n");
}

function BuyerDetailView() {
  const id = useSearchParams().get("id");
  const { data: b, error, mutate } = useSWR<BuyerDetail>(id ? `/buyers/${id}` : null);
  const { data: company } = useSWR<CompanyProfile>("/settings/company");
  const { mutate: globalMutate } = useSWRConfig();
  const [paying, setPaying] = useState(false);
  const [filter, setFilter] = useState<"all" | "unpaid">("all");
  const [actionError, setActionError] = useState<unknown>(null);

  if (error) return <ErrorBox error={error} />;
  if (!b) return <Loading />;

  const act = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await fn();
      await mutate();
      globalMutate((k) => typeof k === "string" && (k.startsWith("/buyers") || k.startsWith("/sales")));
    } catch (e) {
      setActionError(e);
    }
  };

  const balance = Number(b.summary.balance);
  const items = b.timeline.filter(
    (t) => filter === "all" || (t.kind === "SALE" && !t.cancelled && t.paymentStatus !== "PAID"),
  );
  const wa = whatsappLink(b.phone);
  const tel = phoneDigits(b.phone);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={b.name}
        back="/buyers/"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {[b.contactPerson, b.city, b.state].filter(Boolean).join(" · ")}
            {b.gstin && <Badge>GSTIN {b.gstin}</Badge>}
            {!b.active && <Badge>Archived</Badge>}
          </span>
        }
        actions={
          <ButtonLink href={`/buyers/edit/?id=${b.id}`} variant="secondary">
            Edit
          </ButtonLink>
        }
      />

      {(tel || wa) && (
        <div className="flex flex-wrap gap-2">
          {tel && (
            <ButtonLink href={`tel:+${tel}`} variant="secondary" size="sm">
              📞 Call
            </ButtonLink>
          )}
          {wa && (
            <ButtonLink href={wa} variant="secondary" size="sm">
              WhatsApp
            </ButtonLink>
          )}
          {balance > 0 && wa && (
            <ButtonLink href={whatsappLink(b.phone, statementText(b, company))!} variant="secondary" size="sm">
              Send payment reminder
            </ButtonLink>
          )}
        </div>
      )}
      <ErrorBox error={actionError} />

      <Card className="p-4">
        <p className="text-sm text-muted">Balance</p>
        <p className="text-3xl font-semibold tabular-nums">
          <BalanceText balance={b.summary.balance} />
        </p>
        <div className="mt-3 text-sm">
          {Number(b.summary.overdueAmount) > 0 && (
            <Row
              label={<span className="text-red-600 dark:text-red-400">Overdue ({b.summary.overdueCount} invoice{b.summary.overdueCount > 1 ? "s" : ""})</span>}
              value={<span className="text-red-600 dark:text-red-400">{formatINR(b.summary.overdueAmount)}</span>}
            />
          )}
          {Number(b.openingBalance) !== 0 && <Row muted label="Old dues (before app)" value={formatINR(b.openingBalance)} />}
          <Row muted label="Total invoiced" value={formatINR(b.summary.totalSales)} />
          <Row muted label="Total received" value={formatINR(b.summary.totalPaid)} />
          <Row muted label="Credit period" value={`${b.effectiveCreditDays} days`} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <ButtonLink href={`/sales/new/?buyerId=${b.id}`} size="lg">
            + New sale
          </ButtonLink>
          <Button size="lg" variant="secondary" onClick={() => setPaying(true)}>
            Receive payment
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Transactions</h2>
          <div className="w-44">
            <Segmented<"all" | "unpaid">
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All" },
                { value: "unpaid", label: "Unpaid" },
              ]}
            />
          </div>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-muted">{filter === "unpaid" ? "No unpaid invoices." : "No transactions yet."}</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {items.map((t) =>
              t.kind === "SALE" ? (
                <li key={`s${t.id}`}>
                  <Link href={`/sales/detail/?id=${t.id}`} className="flex items-center gap-3 py-2.5 hover:text-brand">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        Invoice {t.invoiceNumber} <Badge tone={saleStatus(t).tone}>{saleStatus(t).label}</Badge>
                      </p>
                      <p className="text-xs text-muted">
                        {formatDay(t.date)}
                        {!t.cancelled && t.paymentStatus !== "PAID" && ` · due ${formatDay(t.dueDate, { weekday: false, year: false })}`}
                        {t.paymentStatus === "PARTIAL" && ` · ${formatINR(t.amountPaid)} paid`}
                      </p>
                    </div>
                    <span className={`tabular-nums ${t.cancelled ? "text-muted line-through" : ""}`}>{formatINR(t.amount)}</span>
                  </Link>
                </li>
              ) : (
                <li key={`p${t.id}`} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-green-700 dark:text-green-400">Payment received</p>
                    <p className="truncate text-xs text-muted">
                      {formatDay(t.date)} · {modeLabel(t.mode)}
                      {t.reference && ` · ${t.reference}`}
                      {t.allocations.length > 0 && ` · for ${t.allocations.map((a) => a.invoiceNumber).join(", ")}`}
                      {t.note && ` · ${t.note}`}
                    </p>
                  </div>
                  <span className="tabular-nums text-green-700 dark:text-green-400">− {formatINR(t.amount)}</span>
                  <button
                    onClick={() =>
                      confirm("Delete this payment? Invoices it paid will show as due again.") &&
                      act(() => api(`/payments/${t.id}`, "DELETE"))
                    }
                    className="rounded p-1 text-muted hover:bg-surface-2"
                    aria-label="Delete payment"
                  >
                    ✕
                  </button>
                </li>
              ),
            )}
          </ul>
        )}
      </Card>

      {(b.address || b.email || b.altPhone || b.notes) && (
        <Card className="space-y-1 p-4 text-sm">
          {b.address && <p>{[b.address, b.city, b.state, b.pincode].filter(Boolean).join(", ")}</p>}
          {b.altPhone && <p className="text-muted">Other phone: {b.altPhone}</p>}
          {b.email && <p className="text-muted">{b.email}</p>}
          {b.notes && <p className="text-muted">{b.notes}</p>}
        </Card>
      )}

      <div className="flex justify-center pb-4">
        <Button
          variant={b.active ? "ghost" : "secondary"}
          size="sm"
          onClick={() => act(() => api(`/buyers/${b.id}`, "PATCH", { active: !b.active }))}
        >
          {b.active ? "Archive buyer" : "Restore buyer"}
        </Button>
      </div>

      {paying && (
        <PaymentSheet buyerId={b.id} buyerName={b.name} balance={balance} onClose={() => setPaying(false)} />
      )}
    </div>
  );
}

export default function BuyerDetailPage() {
  return (
    <Suspense fallback={<Loading />}>
      <BuyerDetailView />
    </Suspense>
  );
}
