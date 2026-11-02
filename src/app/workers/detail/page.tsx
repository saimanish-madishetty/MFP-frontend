"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { formatDay, formatINR } from "@/lib/format";
import { PAYMENT_MODES, payCycleLabel, rateLabel, type WorkerDetail } from "@/lib/workers";
import { Badge, Button, ButtonLink, Card, ErrorBox, Loading, PageHeader, Row, Sheet } from "@/components/ui";
import { AttendanceCalendar } from "@/components/workers/AttendanceCalendar";
import { AdvanceSheet, SettleSheet } from "@/components/workers/PaySheets";
import { PayableAmount } from "@/components/workers/WorkerList";

const modeLabel = (m: string) => PAYMENT_MODES.find((p) => p.value === m)?.label ?? m;

function WorkerDetailView() {
  const id = useSearchParams().get("id");
  const { data: w, error, mutate } = useSWR<WorkerDetail>(id ? `/workers/${id}` : null);
  const { mutate: globalMutate } = useSWRConfig();
  const router = useRouter();
  const [sheet, setSheet] = useState<"settle" | "advance" | "delete" | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [deleting, setDeleting] = useState(false);

  if (error) return <ErrorBox error={error} />;
  if (!w) return <Loading />;
  const s = w.summary;
  const phone = w.phone?.replace(/\D/g, "");

  const setActive = async (active: boolean) => {
    setActionError(null);
    try {
      await api(`/workers/${w.id}`, "PATCH", { active });
      await mutate();
      globalMutate((k) => typeof k === "string" && (k.startsWith("/workers") || k.startsWith("/attendance")));
    } catch (e) {
      setActionError(e);
    }
  };

  const deleteWorker = async () => {
    setDeleting(true);
    setActionError(null);
    try {
      await api(`/workers/${w.id}`, "DELETE");
      globalMutate((k) => typeof k === "string" && (k.startsWith("/workers") || k.startsWith("/attendance")));
      router.replace("/workers/?tab=list");
    } catch (e) {
      setActionError(e);
      setSheet(null);
      setDeleting(false);
    }
  };

  const deleteAdvance = async (advanceId: number) => {
    if (!confirm("Delete this advance?")) return;
    setActionError(null);
    try {
      await api(`/advances/${advanceId}`, "DELETE");
      await mutate();
    } catch (e) {
      setActionError(e);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={w.name}
        back="/workers/?tab=list"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {w.role && <span>{w.role} ·</span>}
            <span>{rateLabel(w)}</span>
            <Badge tone={w.permanent ? "blue" : "neutral"}>{w.permanent ? "Permanent" : "Temporary"}</Badge>
            {!w.active && <Badge>Archived</Badge>}
          </span>
        }
        actions={
          <ButtonLink href={`/workers/edit/?id=${w.id}`} variant="secondary">
            Edit
          </ButtonLink>
        }
      />

      {phone && (
        <div className="flex gap-2">
          <ButtonLink href={`tel:${phone}`} variant="secondary" size="sm">
            📞 Call
          </ButtonLink>
          <ButtonLink
            href={`https://wa.me/${phone.length === 10 ? `91${phone}` : phone}`}
            variant="secondary"
            size="sm"
          >
            WhatsApp
          </ButtonLink>
        </div>
      )}

      <ErrorBox error={actionError} />

      {/* Pay summary */}
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Payable now</p>
            <p className="text-3xl font-semibold tabular-nums">
              <PayableAmount payable={s.payable} />
            </p>
          </div>
          {s.payDue && <Badge tone="amber">Pay due</Badge>}
        </div>
        <div className="mt-3 text-sm">
          <Row muted label={`This period (since ${formatDay(s.periodStart, { weekday: false })})`} value="" />
          <Row label={`${s.daysWorked} day${s.daysWorked === 1 ? "" : "s"} worked`} value={formatINR(s.earned)} />
          {Number(s.bonus) > 0 && <Row label="Bonus" value={`+ ${formatINR(s.bonus)}`} />}
          {Number(s.advances) > 0 && <Row label="Advances" value={`− ${formatINR(s.advances)}`} />}
          {Number(s.broughtForward) !== 0 && (
            <Row
              label="Brought forward"
              value={`${Number(s.broughtForward) > 0 ? "+" : "−"} ${formatINR(Math.abs(Number(s.broughtForward)))}`}
            />
          )}
        </div>
        <p className="mt-2 text-xs text-muted">
          Pay day: {payCycleLabel(w)}
          {s.nextPayDate && ` · next ${formatDay(s.nextPayDate, { year: false })}`}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button size="lg" onClick={() => setSheet("settle")}>
            Settle pay
          </Button>
          <Button size="lg" variant="secondary" onClick={() => setSheet("advance")}>
            Give advance
          </Button>
        </div>
      </Card>

      {/* Attendance */}
      <Card className="p-4">
        <h2 className="mb-2 font-semibold">Attendance</h2>
        <AttendanceCalendar workerId={w.id} />
      </Card>

      {/* Advances */}
      {w.advances.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 font-semibold">Advances</h2>
          <ul className="divide-y divide-border text-sm">
            {w.advances.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p>{formatDay(a.date)}</p>
                  <p className="truncate text-xs text-muted">
                    {modeLabel(a.mode)}
                    {a.note && ` · ${a.note}`}
                  </p>
                </div>
                <span className="tabular-nums">{formatINR(a.amount)}</span>
                <button
                  onClick={() => deleteAdvance(a.id)}
                  className="rounded p-1 text-muted hover:bg-surface-2"
                  aria-label="Delete advance"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Pay history */}
      <Card className="p-4">
        <h2 className="mb-2 font-semibold">Pay history</h2>
        {w.settlements.length === 0 ? (
          <p className="text-sm text-muted">No payments yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {w.settlements.map((st) => (
              <li key={st.id} className="py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Paid {formatDay(st.paidOn)}</span>
                  <span className="font-medium tabular-nums">{formatINR(st.amountPaid)}</span>
                </div>
                <p className="text-xs text-muted">
                  {formatDay(st.periodStart, { weekday: false, year: false })} –{" "}
                  {formatDay(st.periodEnd, { weekday: false, year: false })} · {Number(st.daysWorked)} days ·{" "}
                  {modeLabel(st.mode)}
                  {Number(st.amountPaid) !== Number(st.payable) && ` · payable was ${formatINR(st.payable)}`}
                  {st.reportedChanges.length > 0 &&
                    ` · ${st.reportedChanges.length} correction${st.reportedChanges.length > 1 ? "s" : ""}`}
                  {st.note && ` · ${st.note}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex flex-wrap justify-center gap-2 pb-4">
        {w.active ? (
          <Button variant="ghost" size="sm" onClick={() => setActive(false)}>
            Archive worker (left the job)
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setActive(true)}>
            Restore worker
          </Button>
        )}
        <Button variant="ghost" size="sm" className="text-red-600 dark:text-red-400" onClick={() => setSheet("delete")}>
          Delete permanently
        </Button>
      </div>

      {sheet === "settle" && <SettleSheet workerId={w.id} name={w.name} onClose={() => setSheet(null)} />}
      {sheet === "advance" && <AdvanceSheet workerId={w.id} name={w.name} onClose={() => setSheet(null)} />}
      <Sheet open={sheet === "delete"} title={`Delete ${w.name}?`} onClose={() => !deleting && setSheet(null)}>
        <p className="text-sm">
          This permanently deletes <strong>{w.name}</strong> and all their attendance, advances and pay history. It
          can&apos;t be undone.
        </p>
        <p className="mt-2 text-sm text-muted">To keep the history, archive the worker instead.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setSheet(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={deleteWorker} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete permanently"}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

export default function WorkerDetailPage() {
  return (
    <Suspense fallback={<Loading />}>
      <WorkerDetailView />
    </Suspense>
  );
}
