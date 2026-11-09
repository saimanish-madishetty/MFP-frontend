"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { formatDay, formatINR, todayIST } from "@/lib/format";
import { PAYMENT_MODES, statusLabel, type PaySummary, type PaymentMode } from "@/lib/workers";
import { Button, ErrorBox, Field, Input, Loading, Row, Select, Sheet, Textarea } from "@/components/ui";

const refreshWorkers = (k: unknown) => typeof k === "string" && k.startsWith("/workers");

export function SettleSheet({ workerId, name, onClose }: { workerId: number; name: string; onClose: () => void }) {
  const { mutate } = useSWRConfig();
  const [upTo, setUpTo] = useState(todayIST());
  const [paidOn, setPaidOn] = useState(todayIST());
  const { data: s, error: loadError } = useSWR<PaySummary>(`/workers/${workerId}/settlement-preview?upTo=${upTo}`);
  const [amount, setAmount] = useState<string | null>(null);
  const [mode, setMode] = useState<PaymentMode>("CASH");
  const [note, setNote] = useState("");
  const [showUnmarked, setShowUnmarked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const payable = s ? Number(s.payable) : 0;
  const amountValue = amount ?? (payable > 0 ? s!.payable : "0");
  const remaining = payable - Number(amountValue || 0);

  const confirm = async () => {
    setSaving(true);
    setError(null);
    try {
      await api(`/workers/${workerId}/settlements`, "POST", {
        upTo,
        paidOn,
        amountPaid: Number(amountValue || 0),
        mode,
        note: note.trim() || undefined,
      });
      await mutate(refreshWorkers);
      onClose();
    } catch (e) {
      setError(e);
      setSaving(false);
    }
  };

  return (
    <Sheet open title={`Settle pay · ${name}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pay up to and including">
            <Input type="date" max={todayIST()} value={upTo} onChange={(e) => e.target.value && setUpTo(e.target.value)} />
          </Field>
          <Field label="Payment date">
            <Input type="date" max={todayIST()} value={paidOn} onChange={(e) => e.target.value && setPaidOn(e.target.value)} />
          </Field>
        </div>
        <ErrorBox error={loadError} />
        {!s && !loadError && <Loading />}
        {s && (
          <>
            <div className="rounded-lg bg-surface-2 p-3 text-sm">
              <p className="mb-2 text-xs text-muted">
                {formatDay(s.periodStart, { weekday: false })} – {formatDay(s.upTo, { weekday: false })}
              </p>
              <Row
                label={`Days worked (${s.daysWorked})`}
                value={formatINR(s.earned)}
              />
              <p className="-mt-1 mb-1 text-xs text-muted">
                {s.counts.PRESENT} present · {s.counts.HALF_DAY} half · {s.counts.PAID_LEAVE} paid leave ·{" "}
                {s.counts.ABSENT} absent
              </p>
              {Number(s.bonus) > 0 && <Row label="Bonus" value={`+ ${formatINR(s.bonus)}`} />}
              {Number(s.advances) > 0 && <Row label="Advances" value={`− ${formatINR(s.advances)}`} />}
              {Number(s.broughtForward) !== 0 && (
                <Row
                  label="Brought forward"
                  value={`${Number(s.broughtForward) > 0 ? "+" : "−"} ${formatINR(Math.abs(Number(s.broughtForward)))}`}
                />
              )}
              <div className="mt-2 border-t border-border pt-2">
                <Row
                  strong
                  label="Payable"
                  value={payable < 0 ? `Worker owes ${formatINR(-payable)}` : formatINR(payable)}
                />
              </div>
            </div>

            {s.pendingChanges.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <p className="mb-1 font-medium">Corrections to days already paid</p>
                {s.pendingChanges.map((c) => (
                  <Row
                    key={c.id}
                    label={`${formatDay(c.date, { year: false })}: ${statusLabel(c.oldStatus)} → ${statusLabel(c.newStatus)}`}
                    value={`${Number(c.difference) >= 0 ? "+" : "−"} ${formatINR(Math.abs(Number(c.difference)))}`}
                  />
                ))}
                <p className="mt-1 text-xs text-muted">Included in “Brought forward”.</p>
              </div>
            )}

            {s.unmarkedDays.length > 0 && (
              <div className="rounded-lg border border-border p-3 text-sm">
                <button type="button" className="w-full text-left" onClick={() => setShowUnmarked((v) => !v)}>
                  ⚠ {s.unmarkedDays.length} day{s.unmarkedDays.length > 1 ? "s" : ""} not marked{" "}
                  <span className="text-muted">(weekly offs are fine) {showUnmarked ? "▲" : "▼"}</span>
                </button>
                {showUnmarked && (
                  <p className="mt-2 text-xs text-muted">
                    {s.unmarkedDays.map((d) => formatDay(d, { year: false })).join(", ")}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount paid (₹)">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={amountValue}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
              <Field label="Paid by">
                <Select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)}>
                  {PAYMENT_MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {Math.abs(remaining) >= 0.01 && payable > 0 && (
              <p className="text-xs text-muted">
                {remaining > 0
                  ? `${formatINR(remaining)} will stay owed to ${name}.`
                  : `${formatINR(-remaining)} extra will be taken from the next payment.`}
              </p>
            )}
            <Field label="Note">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <ErrorBox error={error} />
            <Button size="lg" className="w-full" onClick={confirm} disabled={saving}>
              {saving ? "Saving…" : `Confirm · Paid ${formatINR(Number(amountValue || 0))}`}
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}

export function AdvanceSheet({ workerId, name, onClose }: { workerId: number; name: string; onClose: () => void }) {
  const { mutate } = useSWRConfig();
  const [date, setDate] = useState(todayIST());
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<PaymentMode>("CASH");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/workers/${workerId}/advances`, "POST", {
        date,
        amount: Number(amount),
        mode,
        note: note.trim() || undefined,
      });
      await mutate(refreshWorkers);
      onClose();
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <Sheet open title={`Give advance · ${name}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)">
            <Input
              type="number"
              inputMode="decimal"
              min={1}
              required
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Date">
            <Input type="date" max={todayIST()} required value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Given by">
          <Select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)}>
            {PAYMENT_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Note">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. medical, festival" />
        </Field>
        <p className="text-xs text-muted">The advance is deducted automatically from the next payment.</p>
        <ErrorBox error={error} />
        <Button type="submit" size="lg" className="w-full" disabled={saving}>
          {saving ? "Saving…" : "Save advance"}
        </Button>
      </form>
    </Sheet>
  );
}
