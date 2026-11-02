"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { formatINR, todayIST } from "@/lib/format";
import { PAYMENT_MODES, type PaymentMode } from "@/lib/workers";
import { Button, ErrorBox, Field, Input, Select, Sheet } from "@/components/ui";

/** Money received from a buyer. Applied to the oldest unpaid dues automatically. */
export function PaymentSheet({
  buyerId,
  buyerName,
  balance,
  onClose,
}: {
  buyerId: number;
  buyerName: string;
  balance: number;
  onClose: () => void;
}) {
  const { mutate } = useSWRConfig();
  const [amount, setAmount] = useState(balance > 0 ? String(balance) : "");
  const [mode, setMode] = useState<PaymentMode>("CASH");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(todayIST());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/buyers/${buyerId}/payments`, "POST", {
        date,
        amount: Number(amount),
        mode,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
      });
      await mutate((k) => typeof k === "string" && (k.startsWith("/buyers") || k.startsWith("/sales")));
      onClose();
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <Sheet open title={`Receive payment · ${buyerName}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        {balance > 0 && <p className="text-sm text-muted">Total due: {formatINR(balance)}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)">
            <Input
              type="number"
              inputMode="decimal"
              min={0.01}
              step="0.01"
              required
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Received by">
            <Select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)}>
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {mode !== "CASH" && (
          <Field label={mode === "CHEQUE" ? "Cheque number" : "UTR / reference"}>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input type="date" max={todayIST()} required value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Note">
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-muted">Applied to the oldest dues first (old dues, then invoices by date).</p>
        <ErrorBox error={error} />
        <Button type="submit" size="lg" className="w-full" disabled={saving || !(Number(amount) > 0)}>
          {saving ? "Saving…" : `Save ${Number(amount) > 0 ? formatINR(Number(amount)) : "payment"}`}
        </Button>
      </form>
    </Sheet>
  );
}
