"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { refreshExpenses, type Bill } from "@/lib/expenses";
import { formatDay, formatINR, todayIST } from "@/lib/format";
import { PAYMENT_MODES, type PaymentMode } from "@/lib/workers";
import { Badge, Button, Empty, ErrorBox, Field, Input, Loading, Segmented, Select, Sheet } from "@/components/ui";

const modeLabel = (m: string) => PAYMENT_MODES.find((p) => p.value === m)?.label ?? m;

/** Add or edit a bill. */
function BillSheet({ bill, onClose }: { bill?: Bill; onClose: () => void }) {
  const { mutate } = useSWRConfig();
  const [name, setName] = useState(bill?.name ?? "");
  const [amount, setAmount] = useState(bill ? String(Number(bill.amount)) : "");
  const [billDate, setBillDate] = useState(bill?.billDate ?? "");
  const [dueDate, setDueDate] = useState(bill?.dueDate ?? todayIST());
  const [note, setNote] = useState(bill?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = { name: name.trim(), amount: Number(amount), billDate: billDate || null, dueDate, note: note.trim() || null };
    try {
      if (bill) await api(`/bills/${bill.id}`, "PATCH", body);
      else await api("/bills", "POST", body);
      await mutate(refreshExpenses);
      onClose();
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <Sheet open title={bill ? "Edit bill" : "Add bill"} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Bill for" hint="e.g. Electricity, Shop rent, Gas">
          <Input required autoFocus={!bill} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)">
            <Input
              type="number"
              inputMode="decimal"
              min={0.01}
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Pay by">
            <Input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field label="Bill date" hint="Optional">
            <Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
          </Field>
          <Field label="Note" hint="Optional">
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <ErrorBox error={error} />
        <Button type="submit" size="lg" className="w-full" disabled={saving}>
          {saving ? "Saving…" : bill ? "Save changes" : "Add bill"}
        </Button>
      </form>
    </Sheet>
  );
}

/** Mark a bill as paid. */
function PaySheet({ bill, onClose }: { bill: Bill; onClose: () => void }) {
  const { mutate } = useSWRConfig();
  const [paidOn, setPaidOn] = useState(todayIST());
  const [mode, setMode] = useState<PaymentMode>("UPI");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/bills/${bill.id}/pay`, "POST", { paidOn, mode, reference: reference.trim() || undefined });
      await mutate(refreshExpenses);
      onClose();
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <Sheet open title={`Pay ${bill.name} · ${formatINR(bill.amount)}`} onClose={onClose}>
      <form onSubmit={pay} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Paid on">
            <Input type="date" required max={todayIST()} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
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
        <Field label="Reference" hint="Optional, e.g. UTR or cheque number">
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <ErrorBox error={error} />
        <Button type="submit" size="lg" className="w-full" disabled={saving}>
          {saving ? "Saving…" : "Mark as paid"}
        </Button>
      </form>
    </Sheet>
  );
}

/** Bills to pay (soonest due first, overdue in red) and paid bills. */
export function BillList() {
  const { mutate } = useSWRConfig();
  const [status, setStatus] = useState<"unpaid" | "paid">("unpaid");
  const { data, error, isLoading } = useSWR<Bill[]>(`/bills?status=${status}`);
  const [editing, setEditing] = useState<Bill | "new" | null>(null);
  const [paying, setPaying] = useState<Bill | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const today = todayIST();
  const total = (data ?? []).reduce((a, b) => a + Number(b.amount), 0);

  const act = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await fn();
      await mutate(refreshExpenses);
    } catch (err) {
      setActionError(err);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          <Segmented<"unpaid" | "paid">
            value={status}
            onChange={setStatus}
            options={[
              { value: "unpaid", label: "To pay" },
              { value: "paid", label: "Paid" },
            ]}
          />
        </div>
        <Button className="shrink-0" onClick={() => setEditing("new")}>
          + Add bill
        </Button>
      </div>

      <ErrorBox error={error ?? actionError} />
      {isLoading && <Loading />}
      {data && data.length === 0 && (
        <Empty>{status === "unpaid" ? "No bills to pay." : "No paid bills yet."}</Empty>
      )}
      {data && data.length > 0 && status === "unpaid" && (
        <p className="text-sm text-muted">
          {data.length} to pay · <span className="font-medium text-foreground tabular-nums">{formatINR(total)}</span>
        </p>
      )}

      <ul className="space-y-2">
        {data?.map((b) => (
          <li key={b.id} className="rounded-xl border border-border bg-surface p-3">
            <div className="flex items-start gap-3">
              <button type="button" onClick={() => setEditing(b)} className="min-w-0 flex-1 text-left">
                <p className="truncate font-medium">{b.name}</p>
                <p className="truncate text-xs text-muted">
                  {b.paidOn
                    ? `Paid ${formatDay(b.paidOn, { year: false })}${b.mode ? ` · ${modeLabel(b.mode)}` : ""}${b.reference ? ` · ${b.reference}` : ""}`
                    : `Pay by ${formatDay(b.dueDate, { year: false })}`}
                  {b.note && ` · ${b.note}`}
                </p>
              </button>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-semibold tabular-nums">{formatINR(b.amount)}</span>
                {b.overdue && <Badge tone="red">Overdue</Badge>}
                {!b.paidOn && !b.overdue && b.dueDate === today && <Badge tone="amber">Due today</Badge>}
              </div>
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => confirm(`Delete the bill "${b.name}"?`) && act(() => api(`/bills/${b.id}`, "DELETE"))}
              >
                Delete
              </Button>
              {b.paidOn ? (
                <Button variant="secondary" size="sm" onClick={() => act(() => api(`/bills/${b.id}/unpay`, "POST"))}>
                  Mark unpaid
                </Button>
              ) : (
                <Button size="sm" onClick={() => setPaying(b)}>
                  Pay
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {editing && <BillSheet bill={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      {paying && <PaySheet bill={paying} onClose={() => setPaying(null)} />}
    </div>
  );
}
