"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { WEEKDAYS, formatINR, ordinal, todayIST, ymd } from "@/lib/format";
import type { PayCycle, PayType, Worker } from "@/lib/workers";
import { Button, Card, ErrorBox, Field, Input, Segmented, Select, Textarea } from "@/components/ui";

type FormState = {
  name: string;
  phone: string;
  role: string;
  joiningDate: string;
  payType: PayType;
  rate: string;
  workingDaysPerMonth: string;
  payCycle: PayCycle;
  payWeekday: string;
  payMonthDay: string;
  notes: string;
  permanent: boolean;
};

function initialState(worker?: Worker): FormState {
  return {
    name: worker?.name ?? "",
    phone: worker?.phone ?? "",
    role: worker?.role ?? "",
    joiningDate: worker ? ymd(worker.joiningDate) : todayIST(),
    payType: worker?.payType ?? "DAILY",
    rate: worker?.rate ?? "",
    workingDaysPerMonth: String(worker?.workingDaysPerMonth ?? 26),
    payCycle: worker?.payCycle ?? "WEEKLY",
    payWeekday: String(worker?.payWeekday ?? 6),
    payMonthDay: String(worker?.payMonthDay ?? 1),
    notes: worker?.notes ?? "",
    permanent: worker?.permanent ?? false,
  };
}

export function WorkerForm({ worker }: { worker?: Worker }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [f, setF] = useState(() => initialState(worker));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  const dayValue =
    f.payType === "MONTHLY" && Number(f.rate) > 0 && Number(f.workingDaysPerMonth) > 0
      ? Number(f.rate) / Number(f.workingDaysPerMonth)
      : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = {
      name: f.name.trim(),
      phone: f.phone.trim() || undefined,
      role: f.role.trim() || undefined,
      joiningDate: f.joiningDate,
      payType: f.payType,
      rate: Number(f.rate),
      workingDaysPerMonth: f.payType === "MONTHLY" ? Number(f.workingDaysPerMonth) : undefined,
      payCycle: f.payCycle,
      payWeekday: f.payCycle === "WEEKLY" ? Number(f.payWeekday) : undefined,
      payMonthDay: f.payCycle === "MONTHLY" ? Number(f.payMonthDay) : undefined,
      notes: f.notes.trim() || undefined,
      permanent: f.permanent,
    };
    try {
      const saved = worker
        ? await api<Worker>(`/workers/${worker.id}`, "PATCH", body)
        : await api<Worker>("/workers", "POST", body);
      await mutate((k) => typeof k === "string" && (k.startsWith("/workers") || k.startsWith("/attendance")));
      // Edit returns to the details page it came from; a new record replaces the "new" page.
      if (worker) router.back();
      else router.replace(`/workers/detail/?id=${saved.id}`);
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card className="space-y-4 p-4">
        <Field label="Name">
          <Input required value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus={!worker} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">
            <Input type="tel" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Work / role" hint="e.g. Machine operator, Packing">
            <Input value={f.role} onChange={(e) => set("role", e.target.value)} />
          </Field>
        </div>
        <Field label="Joining date">
          <Input
            type="date"
            required
            max={todayIST()}
            value={f.joiningDate}
            onChange={(e) => set("joiningDate", e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={f.permanent}
            onChange={(e) => set("permanent", e.target.checked)}
            className="h-5 w-5 accent-brand"
          />
          <span>
            <span className="font-medium">Permanent worker</span>
            <span className="block text-xs text-muted">Leave unticked for temporary workers.</span>
          </span>
        </label>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="font-semibold">Pay</h2>
        <Segmented<PayType>
          value={f.payType}
          onChange={(v) => set("payType", v)}
          options={[
            { value: "DAILY", label: "Per day" },
            { value: "MONTHLY", label: "Per month" },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={f.payType === "DAILY" ? "Daily wage (₹)" : "Monthly salary (₹)"}>
            <Input
              type="number"
              inputMode="decimal"
              min={1}
              step="0.01"
              required
              value={f.rate}
              onChange={(e) => set("rate", e.target.value)}
            />
          </Field>
          {f.payType === "MONTHLY" && (
            <Field
              label="Working days per month"
              hint={dayValue !== null ? `One day = ${formatINR(Math.round(dayValue * 100) / 100)}` : undefined}
            >
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                required
                value={f.workingDaysPerMonth}
                onChange={(e) => set("workingDaysPerMonth", e.target.value)}
              />
            </Field>
          )}
        </div>
        {worker && (
          <p className="text-xs text-muted">Changing the pay only affects days marked after the change.</p>
        )}

        <Field label="Pay day">
          <Select value={f.payCycle} onChange={(e) => set("payCycle", e.target.value as PayCycle)}>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="MANUAL">No fixed day</option>
          </Select>
        </Field>
        {f.payCycle === "WEEKLY" && (
          <Field label="Paid every">
            <Select value={f.payWeekday} onChange={(e) => set("payWeekday", e.target.value)}>
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {f.payCycle === "MONTHLY" && (
          <Field label="Paid on" hint="Months with fewer days use the last day.">
            <Select value={f.payMonthDay} onChange={(e) => set("payMonthDay", e.target.value)}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {ordinal(d)} of the month
                </option>
              ))}
            </Select>
          </Field>
        )}
      </Card>

      <Card className="p-4">
        <Field label="Notes">
          <Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </Card>

      <ErrorBox error={error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={saving}>
          {saving ? "Saving…" : worker ? "Save changes" : "Add worker"}
        </Button>
      </div>
    </form>
  );
}
