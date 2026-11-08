"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useSyncExternalStore } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { INDIAN_STATES } from "@/lib/buyers";
import type { CompanyProfile } from "@/lib/sales";
import { getTheme, setTheme, subscribeTheme, type ThemeChoice } from "@/lib/theme";
import { useAuth } from "@/lib/use-auth";
import { UserList } from "@/components/settings/UserList";
import {
  Button,
  Card,
  ErrorBox,
  Field,
  Input,
  Loading,
  PageHeader,
  Segmented,
  Select,
  Textarea,
} from "@/components/ui";

type Form = Record<keyof CompanyProfile, string | boolean | number>;

function CompanyForm({ company, onSaved }: { company: CompanyProfile; onSaved: () => void }) {
  const [f, setF] = useState<CompanyProfile>(company);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const text = (k: keyof CompanyProfile) => ({
    value: (f[k] as string | null) ?? "",
    onChange: (e: { target: { value: string } }) => {
      setSaved(false);
      setF((p) => ({ ...p, [k]: e.target.value }));
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = Object.fromEntries(
      Object.entries(f)
        .filter(([k]) => !["id", "updatedAt", "logoUrl"].includes(k))
        .map(([k, v]) => [k, typeof v === "string" ? v.trim() || null : v])
    ) as Form;
    body.defaultCreditDays = Number(f.defaultCreditDays);
    try {
      await api("/settings/company", "PUT", body);
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card className="space-y-4 p-4">
        <h2 className="font-semibold">Business</h2>
        <Field label="Business name">
          <Input required {...text("businessName")} />
        </Field>
        <Field label="Address">
          <Textarea {...text("address")} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="City">
            <Input {...text("city")} />
          </Field>
          <Field label="Pincode">
            <Input inputMode="numeric" {...text("pincode")} />
          </Field>
        </div>
        <Field label="State">
          <Select {...text("state")}>
            <option value="">—</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone">
            <Input type="tel" {...text("phone")} />
          </Field>
          <Field label="Email">
            <Input type="email" {...text("email")} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="font-semibold">GST & licences</h2>
        <Field label="GSTIN" hint="Leave blank if not GST-registered: invoices become plain bills without GST.">
          <Input className="uppercase" maxLength={15} {...text("gstin")} />
        </Field>
        <Field label="FSSAI licence number">
          <Input {...text("fssaiNumber")} />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={f.pricesIncludeGst}
            onChange={(e) => {
              setSaved(false);
              setF((p) => ({ ...p, pricesIncludeGst: e.target.checked }));
            }}
          />
          <span>
            <span className="font-medium">My prices include GST</span>
            <span className="block text-xs text-muted">
              If ticked, GST is taken out of the rate. If not, GST is added on top.
            </span>
          </span>
        </label>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="font-semibold">Payments to you</h2>
        <Field label="UPI ID" hint="Printed on invoices with a QR code for the amount due">
          <Input placeholder="name@bank" {...text("upiId")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bank name">
            <Input {...text("bankName")} />
          </Field>
          <Field label="Account name">
            <Input {...text("bankAccountName")} />
          </Field>
          <Field label="Account number">
            <Input inputMode="numeric" {...text("bankAccountNumber")} />
          </Field>
          <Field label="IFSC">
            <Input className="uppercase" {...text("bankIfsc")} />
          </Field>
        </div>
        <Field label="Default credit period (days)" hint="How long buyers have to pay. Can be changed per buyer.">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={365}
            required
            value={String(f.defaultCreditDays)}
            onChange={(e) => {
              setSaved(false);
              setF((p) => ({ ...p, defaultCreditDays: Number(e.target.value) }));
            }}
          />
        </Field>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="font-semibold">Invoice</h2>
        <Field label="Invoice number prefix" hint="Numbers look like MF/2026-27/0001">
          <Input required maxLength={10} {...text("invoicePrefix")} />
        </Field>
        <Field label="Terms printed on invoices">
          <Textarea rows={3} {...text("termsText")} />
        </Field>
        <Field label="Signatory name" hint="Shown under the signature line">
          <Input {...text("signatoryName")} />
        </Field>
      </Card>

      <ErrorBox error={error} />
      <div className="flex items-center justify-end gap-3 pb-4">
        {saved && <span className="text-sm text-green-600 dark:text-green-400">Saved ✓</span>}
        <Button type="submit" size="lg" disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}

function BusinessSettings() {
  const { data, error, mutate } = useSWR<CompanyProfile>("/settings/company");
  return (
    <>
      <p className="mb-4 text-sm text-muted">Your business details, printed on every invoice.</p>
      <ErrorBox error={error} />
      {!data && !error && <Loading />}
      {data && <CompanyForm company={data} onSaved={() => mutate()} />}
    </>
  );
}

/** Light, dark or the phone's setting; kept on this device (not shared with other users). */
function ThemeSetting() {
  // The page is pre-rendered without it ("system"), then reads this device's choice.
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => "system" as const);
  return (
    <Card className="mb-4 space-y-2 p-4">
      <h2 className="font-semibold">Theme</h2>
      <Segmented<ThemeChoice>
        value={theme}
        onChange={setTheme}
        options={[
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
          { value: "system", label: "Phone" },
        ]}
      />
      <p className="text-xs text-muted">Phone follows your phone&apos;s light or dark setting. Only for this device.</p>
    </Card>
  );
}

type Tab = "business" | "users";

function SettingsHome() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const wanted = useSearchParams().get("tab");
  // Only admins see the Users tab.
  const tab: Tab = isAdmin && wanted === "users" ? "users" : "business";
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" />
      <ThemeSetting />
      {isAdmin && (
        <div className="mb-4">
          <Segmented<Tab>
            value={tab}
            onChange={(t) => router.replace(t === "users" ? "/settings/?tab=users" : "/settings/")}
            options={[
              { value: "business", label: "Business" },
              { value: "users", label: "Users" },
            ]}
          />
        </div>
      )}
      {tab === "users" ? <UserList /> : <BusinessSettings />}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SettingsHome />
    </Suspense>
  );
}
