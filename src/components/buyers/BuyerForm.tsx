"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { INDIAN_STATES, type Buyer } from "@/lib/buyers";
import type { CompanyProfile } from "@/lib/sales";
import { Button, Card, ErrorBox, Field, Input, Select, Textarea } from "@/components/ui";

export function BuyerForm({ buyer }: { buyer?: Buyer }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: company } = useSWR<CompanyProfile>("/settings/company");
  const [f, setF] = useState({
    name: buyer?.name ?? "",
    contactPerson: buyer?.contactPerson ?? "",
    phone: buyer?.phone ?? "",
    altPhone: buyer?.altPhone ?? "",
    email: buyer?.email ?? "",
    address: buyer?.address ?? "",
    city: buyer?.city ?? "",
    state: buyer?.state ?? "",
    pincode: buyer?.pincode ?? "",
    gstin: buyer?.gstin ?? "",
    creditDays: buyer?.creditDays !== null && buyer?.creditDays !== undefined ? String(buyer.creditDays) : "",
    openingBalance: buyer && Number(buyer.openingBalance) !== 0 ? buyer.openingBalance : "",
    notes: buyer?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));
  const state = f.state || (buyer ? "" : (company?.state ?? ""));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const text = (v: string) => v.trim() || null;
    const body = {
      name: f.name.trim(),
      contactPerson: text(f.contactPerson),
      phone: text(f.phone),
      altPhone: text(f.altPhone),
      email: text(f.email),
      address: text(f.address),
      city: text(f.city),
      state: text(state),
      pincode: text(f.pincode),
      gstin: text(f.gstin),
      creditDays: f.creditDays === "" ? null : Number(f.creditDays),
      openingBalance: f.openingBalance === "" ? 0 : Number(f.openingBalance),
      notes: text(f.notes),
    };
    try {
      const saved = buyer
        ? await api<Buyer>(`/buyers/${buyer.id}`, "PATCH", body)
        : await api<Buyer>("/buyers", "POST", body);
      await mutate((k) => typeof k === "string" && k.startsWith("/buyers"));
      // Edit returns to the details page it came from; a new record replaces the "new" page.
      if (buyer) router.back();
      else router.replace(`/buyers/detail/?id=${saved.id}`);
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card className="space-y-4 p-4">
        <Field label="Shop / business name">
          <Input required value={f.name} onChange={set("name")} autoFocus={!buyer} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact person">
            <Input value={f.contactPerson} onChange={set("contactPerson")} />
          </Field>
          <Field label="Phone (WhatsApp)">
            <Input type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} />
          </Field>
          <Field label="Other phone">
            <Input type="tel" inputMode="tel" value={f.altPhone} onChange={set("altPhone")} />
          </Field>
          <Field label="Email">
            <Input type="email" value={f.email} onChange={set("email")} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="font-semibold">Address & GST</h2>
        <Field label="Address">
          <Textarea value={f.address} onChange={set("address")} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="City">
            <Input value={f.city} onChange={set("city")} />
          </Field>
          <Field label="Pincode">
            <Input inputMode="numeric" value={f.pincode} onChange={set("pincode")} />
          </Field>
        </div>
        <Field label="State" hint="Decides CGST + SGST (same state) or IGST (other state) on invoices">
          <Select value={state} onChange={set("state")}>
            <option value="">—</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="GSTIN" hint="Optional, 15 characters">
          <Input value={f.gstin} onChange={set("gstin")} className="uppercase" maxLength={15} />
        </Field>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="font-semibold">Payments</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Credit days" hint={`Blank = default (${company?.defaultCreditDays ?? 15} days)`}>
            <Input type="number" inputMode="numeric" min={0} max={365} value={f.creditDays} onChange={set("creditDays")} />
          </Field>
          <Field label="Old dues (₹)" hint="Owed before using this app">
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={f.openingBalance}
              onChange={set("openingBalance")}
            />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea value={f.notes} onChange={set("notes")} />
        </Field>
      </Card>

      <ErrorBox error={error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={saving}>
          {saving ? "Saving…" : buyer ? "Save changes" : "Add buyer"}
        </Button>
      </div>
    </form>
  );
}
