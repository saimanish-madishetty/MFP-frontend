"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { formatDay, formatINR } from "@/lib/format";
import { STATUSES, statusLabel, type AttendanceRow, type AttendanceStatus } from "@/lib/workers";
import { Button, ButtonLink, DateStepper, Empty, ErrorBox, Input, Loading, Sheet } from "@/components/ui";

type Edit = { status: AttendanceStatus | null; bonus: string };

/** Mark one day's attendance for all workers. Keyed by date by the parent, so edits reset per day. */
export function AttendanceDay({ date, onDateChange }: { date: string; onDateChange: (d: string) => void }) {
  const key = `/attendance?date=${date}`;
  const { data, error, isLoading, mutate } = useSWR<{ date: string; rows: AttendanceRow[] }>(key);
  const { mutate: globalMutate } = useSWRConfig();
  const [edits, setEdits] = useState<Record<number, Edit>>({});
  const [bonusOpen, setBonusOpen] = useState<Record<number, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);

  const rows = data?.rows ?? [];
  const current = (r: AttendanceRow): Edit => edits[r.worker.id] ?? { status: r.status, bonus: r.bonus };
  const isDirty = (r: AttendanceRow) => {
    const e = edits[r.worker.id];
    return e !== undefined && (e.status !== r.status || Number(e.bonus || 0) !== Number(r.bonus));
  };
  const dirty = rows.filter(isDirty);
  const dirtySettled = dirty.filter((r) => r.settled);
  const markedCount = rows.filter((r) => current(r).status !== null).length;

  const setEdit = (r: AttendanceRow, patch: Partial<Edit>) =>
    setEdits((prev) => ({ ...prev, [r.worker.id]: { ...current(r), ...patch } }));

  const toggleStatus = (r: AttendanceRow, status: AttendanceStatus) =>
    setEdit(r, { status: current(r).status === status ? null : status });

  const markAllPresent = () => {
    const next = { ...edits };
    for (const r of rows) {
      if (current(r).status === null) next[r.worker.id] = { ...current(r), status: "PRESENT" };
    }
    setEdits(next);
  };

  const save = async () => {
    setConfirmOpen(false);
    setSaving(true);
    setSaveError(null);
    try {
      await api("/attendance", "PUT", {
        date,
        entries: dirty.map((r) => {
          const e = current(r);
          return { workerId: r.worker.id, status: e.status, bonus: Number(e.bonus || 0) };
        }),
      });
      await mutate();
      setEdits({});
      // Pay figures changed everywhere.
      globalMutate((k) => typeof k === "string" && k.startsWith("/workers"));
    } catch (e) {
      setSaveError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 pb-24">
      <DateStepper date={date} onChange={onDateChange} />

      <ErrorBox error={error} />
      {isLoading && <Loading />}

      {data && rows.length === 0 && (
        <Empty>
          No workers yet.{" "}
          <ButtonLink href="/workers/new/" variant="ghost" size="sm">
            + Add a worker
          </ButtonLink>
        </Empty>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">
              {markedCount} / {rows.length} marked
            </span>
            {markedCount < rows.length && (
              <Button variant="secondary" size="sm" onClick={markAllPresent}>
                Mark rest present
              </Button>
            )}
          </div>

          {/* Rows come sorted permanent-first; show them under two headings. */}
          {[
            { title: "Permanent", rows: rows.filter((r) => r.worker.permanent) },
            { title: "Temporary", rows: rows.filter((r) => !r.worker.permanent) },
          ]
            .filter((g) => g.rows.length > 0)
            .map((g) => (
              <section key={g.title} className="space-y-2">
                <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
                  {g.title} · {g.rows.length}
                </h2>
                <ul className="space-y-2">
                  {g.rows.map((r) => {
                    const e = current(r);
                    const showBonus = bonusOpen[r.worker.id] || Number(e.bonus) > 0;
                    return (
                      <li
                        key={r.worker.id}
                        className={`rounded-xl border bg-surface p-3 ${isDirty(r) ? "border-brand" : "border-border"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{r.worker.name}</p>
                            <p className="truncate text-xs text-muted">
                              {r.settled ? "Paid · " : ""}
                              {statusLabel(e.status)}
                              {Number(e.bonus) > 0 && ` · +${formatINR(e.bonus)} bonus`}
                            </p>
                          </div>
                          <div className="flex gap-1.5">
                            {STATUSES.map((s) => (
                              <button
                                key={s.value}
                                type="button"
                                title={s.label}
                                onClick={() => toggleStatus(r, s.value)}
                                className={`h-11 w-11 rounded-lg border text-base font-semibold transition ${
                                  e.status === s.value ? s.on : "border-border text-muted hover:bg-surface-2"
                                }`}
                              >
                                {s.short}
                              </button>
                            ))}
                          </div>
                        </div>
                        {e.status !== null &&
                          (showBonus ? (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-sm text-muted">Bonus ₹</span>
                              <Input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                placeholder="0"
                                value={Number(e.bonus) === 0 ? "" : e.bonus}
                                onChange={(ev) => setEdit(r, { bonus: ev.target.value })}
                                className="max-w-32"
                              />
                              <button
                                type="button"
                                aria-label="Remove bonus"
                                onClick={() => {
                                  setEdit(r, { bonus: "0" });
                                  setBonusOpen((p) => ({ ...p, [r.worker.id]: false }));
                                }}
                                className="rounded-lg p-2 text-muted hover:bg-surface-2"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setBonusOpen((p) => ({ ...p, [r.worker.id]: true }))}
                              className="mt-1 text-xs font-medium text-brand"
                            >
                              + Bonus
                            </button>
                          ))}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
        </>
      )}

      {/* Sticky save bar */}
      {dirty.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 pt-3 pb-safe-bottom backdrop-blur md:left-60">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="flex-1 text-sm">
              <ErrorBox error={saveError} />
              {!saveError && `${dirty.length} change${dirty.length > 1 ? "s" : ""} not saved`}
            </div>
            <Button variant="ghost" onClick={() => setEdits({})} disabled={saving}>
              Undo
            </Button>
            <Button
              size="lg"
              disabled={saving}
              onClick={() => (dirtySettled.length > 0 ? setConfirmOpen(true) : save())}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}

      <Sheet open={confirmOpen} title="Change days already paid?" onClose={() => setConfirmOpen(false)}>
        <p className="text-sm">
          {formatDay(date)} was already paid for <strong>{dirtySettled.map((r) => r.worker.name).join(", ")}</strong>.
          The difference will be added to (or taken from) their next payment, and the change will be shown when you
          settle pay.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Save changes</Button>
        </div>
      </Sheet>
    </div>
  );
}
