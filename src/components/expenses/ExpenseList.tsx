"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { DEFAULT_CATEGORIES, refreshExpenses, type Expense, type ExpenseMonth } from "@/lib/expenses";
import { addMonths, formatDay, formatINR, formatMonth, todayIST } from "@/lib/format";
import { PAYMENT_MODES, type PaymentMode } from "@/lib/workers";
import { Button, Card, Empty, ErrorBox, Field, Input, Loading, Select, Sheet } from "@/components/ui";

const modeLabel = (m: string) => PAYMENT_MODES.find((p) => p.value === m)?.label ?? m;

/** Add or edit one expense. */
function ExpenseSheet({ expense, onClose }: { expense?: Expense; onClose: () => void }) {
  const { mutate } = useSWRConfig();
  const { data: past } = useSWR<string[]>("/expenses/categories");
  const [date, setDate] = useState(expense?.date ?? todayIST());
  const [amount, setAmount] = useState(expense ? String(Number(expense.amount)) : "");
  const [category, setCategory] = useState(expense?.category ?? "");
  const [note, setNote] = useState(expense?.note ?? "");
  const [mode, setMode] = useState<PaymentMode>(expense?.mode ?? "CASH");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const suggestions = [...new Set([...(past ?? []), ...DEFAULT_CATEGORIES])].slice(0, 8);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = { date, amount: Number(amount), category: category.trim(), note: note.trim() || null, mode };
    try {
      if (expense) await api(`/expenses/${expense.id}`, "PATCH", body);
      else await api("/expenses", "POST", body);
      await mutate(refreshExpenses);
      onClose();
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <Sheet open title={expense ? "Edit expense" : "Add expense"} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
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
          <Field label="Date">
            <Input type="date" required max={todayIST()} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="For">
          <Input required placeholder="e.g. Transport" value={category} onChange={(e) => setCategory(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3 py-1 text-xs ${
                category === c ? "border-brand bg-brand/10 text-brand" : "border-border text-muted hover:bg-surface-2"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Paid by">
            <Select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)}>
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Note" hint="Optional">
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <ErrorBox error={error} />
        <Button type="submit" size="lg" className="w-full" disabled={saving}>
          {saving ? "Saving…" : expense ? "Save changes" : "Add expense"}
        </Button>
      </form>
    </Sheet>
  );
}

/** Miscellaneous expenses for one month, with a total and a breakdown by category. */
export function ExpenseList() {
  const { mutate } = useSWRConfig();
  const [month, setMonth] = useState(() => todayIST().slice(0, 7));
  const { data, error, isLoading } = useSWR<ExpenseMonth>(`/expenses?month=${month}`);
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const thisMonth = todayIST().slice(0, 7);

  const remove = async (e: Expense) => {
    if (!confirm(`Delete this expense of ${formatINR(e.amount)} (${e.category})?`)) return;
    setActionError(null);
    try {
      await api(`/expenses/${e.id}`, "DELETE");
      await mutate(refreshExpenses);
    } catch (err) {
      setActionError(err);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>
            ‹
          </Button>
          <span className="min-w-28 text-center font-medium">{formatMonth(month)}</span>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Next month"
            disabled={month >= thisMonth}
            onClick={() => setMonth(addMonths(month, 1))}
          >
            ›
          </Button>
        </div>
        <Button onClick={() => setEditing("new")}>+ Add expense</Button>
      </div>

      <ErrorBox error={error ?? actionError} />
      {isLoading && <Loading />}

      {data && (
        <Card className="p-4">
          <p className="text-sm text-muted">Spent in {formatMonth(month)}</p>
          <p className="text-3xl font-semibold tabular-nums">{formatINR(data.total)}</p>
          {data.byCategory.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              {data.byCategory.map((c) => (
                <span key={c.category}>
                  {c.category} <span className="tabular-nums">{formatINR(c.total)}</span>
                </span>
              ))}
            </div>
          )}
        </Card>
      )}

      {data && data.items.length === 0 && <Empty>No expenses in {formatMonth(month)}.</Empty>}

      {data && data.items.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface text-sm">
          {data.items.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
              <button type="button" onClick={() => setEditing(e)} className="min-w-0 flex-1 text-left">
                <p className="truncate font-medium">{e.category}</p>
                <p className="truncate text-xs text-muted">
                  {formatDay(e.date, { year: false })} · {modeLabel(e.mode)}
                  {e.note && ` · ${e.note}`}
                </p>
              </button>
              <span className="tabular-nums">{formatINR(e.amount)}</span>
              <button
                type="button"
                onClick={() => remove(e)}
                className="rounded p-1 text-muted hover:bg-surface-2"
                aria-label="Delete expense"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && <ExpenseSheet expense={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
