"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { addMonths, formatDay, formatINR, formatMonth, todayIST } from "@/lib/format";
import { STATUSES, statusLabel, type AttendanceStatus, type MonthAttendance } from "@/lib/workers";
import { Button, ErrorBox, Field, Input, Sheet } from "@/components/ui";

const WEEK_HEADER = ["S", "M", "T", "W", "T", "F", "S"];

export function AttendanceCalendar({ workerId }: { workerId: number }) {
  const today = todayIST();
  const [month, setMonth] = useState(today.slice(0, 7));
  const { data, error } = useSWR<MonthAttendance>(`/workers/${workerId}/attendance?month=${month}`);
  const [editing, setEditing] = useState<string | null>(null);

  const byDate = new Map(data?.days.map((d) => [d.date, d]));
  const first = new Date(`${month}-01T00:00:00Z`);
  const leadingBlanks = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const editingDay = editing ? byDate.get(editing) : undefined;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
          ‹
        </Button>
        <span className="font-medium">{formatMonth(month)}</span>
        <Button
          variant="ghost"
          size="sm"
          disabled={month >= today.slice(0, 7)}
          onClick={() => setMonth(addMonths(month, 1))}
          aria-label="Next month"
        >
          ›
        </Button>
      </div>
      <ErrorBox error={error} />

      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {WEEK_HEADER.map((d, i) => (
          <div key={i} className="py-1 text-muted">
            {d}
          </div>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`b${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`;
          const rec = byDate.get(date);
          const style = STATUSES.find((s) => s.value === rec?.status);
          const disabled = date > today || (data !== undefined && date < data.joiningDate);
          const paid = data?.settledUpTo !== null && data !== undefined && date <= (data.settledUpTo ?? "");
          return (
            <button
              key={date}
              type="button"
              disabled={disabled}
              onClick={() => setEditing(date)}
              className={`relative aspect-square rounded-lg text-sm font-medium transition disabled:opacity-30 ${
                style ? style.cell : "bg-surface-2/60 text-muted"
              } ${date === today ? "ring-2 ring-brand" : ""}`}
            >
              {i + 1}
              {rec && Number(rec.bonus) > 0 && (
                <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-brand" />
              )}
              {paid && <span className="absolute inset-x-2 bottom-1 h-0.5 rounded bg-current opacity-40" />}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {STATUSES.map((s) => (
          <span key={s.value} className="flex items-center gap-1">
            <span className={`h-3 w-3 rounded ${s.cell}`} /> {s.label}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Bonus
        </span>
        <span className="flex items-center gap-1">
          <span className="h-0.5 w-3 rounded bg-current opacity-40" /> Paid
        </span>
      </div>

      {editing && (
        <DayEditSheet
          key={editing}
          workerId={workerId}
          date={editing}
          status={editingDay?.status ?? null}
          bonus={editingDay?.bonus ?? "0"}
          paid={data?.settledUpTo !== null && data !== undefined && editing <= (data.settledUpTo ?? "")}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function DayEditSheet({
  workerId,
  date,
  status: initialStatus,
  bonus: initialBonus,
  paid,
  onClose,
}: {
  workerId: number;
  date: string;
  status: AttendanceStatus | null;
  bonus: string;
  paid: boolean;
  onClose: () => void;
}) {
  const { mutate } = useSWRConfig();
  const [status, setStatus] = useState<AttendanceStatus | null>(initialStatus);
  const [bonus, setBonus] = useState(Number(initialBonus) > 0 ? initialBonus : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api("/attendance", "PUT", {
        date,
        entries: [{ workerId, status, bonus: status ? Number(bonus || 0) : 0 }],
      });
      await mutate((k) => typeof k === "string" && (k.startsWith("/workers") || k.startsWith("/attendance")));
      onClose();
    } catch (e) {
      setError(e);
      setSaving(false);
    }
  };

  return (
    <Sheet open title={formatDay(date)} onClose={onClose}>
      <div className="space-y-4">
        {paid && (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
            This day was already paid. Any difference will be added to (or taken from) the next payment.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatus(status === s.value ? null : s.value)}
              className={`h-12 rounded-lg border font-medium ${status === s.value ? s.on : "border-border"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted">
          {status ? statusLabel(status) : "Not marked (tap a selected option again to clear)"}
        </p>
        {status && (
          <Field label="Bonus (₹)" hint="Overtime or extra work for this day">
            <Input type="number" inputMode="decimal" min={0} value={bonus} onChange={(e) => setBonus(e.target.value)} />
          </Field>
        )}
        <ErrorBox error={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
        {Number(bonus) > 0 && <p className="text-right text-xs text-muted">Bonus {formatINR(bonus)}</p>}
      </div>
    </Sheet>
  );
}
