"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { GST_RATES, type Product, type ProductGroup } from "@/lib/products";
import type { MaterialListItem } from "@/lib/stock";
import { Button, Card, ErrorBox, Field, Input, Loading, Select } from "@/components/ui";
import { SizeSections } from "./SizeSections";
import { draftBody, draftFrom, type SizeDraft } from "./size-draft";

/** HSN code and GST rate inputs (a single product's, or the shared ones of a product with sizes). */
export function GstFields({
  hsnCode,
  gstRate,
  onChange,
}: {
  hsnCode: string;
  gstRate: string;
  onChange: (patch: { hsnCode?: string; gstRate?: string }) => void;
}) {
  return (
    <>
      <Field label="HSN code" hint="e.g. 1902 for noodles">
        <Input value={hsnCode} onChange={(e) => onChange({ hsnCode: e.target.value })} />
      </Field>
      <Field label="GST rate">
        <Select value={gstRate} onChange={(e) => onChange({ gstRate: e.target.value })}>
          {GST_RATES.map((r) => (
            <option key={r} value={r}>
              {r}%
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}

/**
 * Add or edit a product on its own, or one size of a product with sizes. `template` pre-fills a
 * new product from an existing one (Duplicate / Add size). `groupId`: a new size of that product.
 */
export function ProductForm({
  product,
  template,
  groupId: newInGroup,
}: {
  product?: Product;
  template?: Product;
  groupId?: number;
}) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: materials } = useSWR<MaterialListItem[]>("/materials?includeInactive=true");
  const src = product ?? template;
  // A size: its names, HSN and GST come from its product; it has a value for each thing that varies.
  const groupId = product ? product.groupId : newInGroup ?? null;
  const { data: group } = useSWR<ProductGroup>(groupId ? `/product-groups/${groupId}` : null);
  const [options, setOptions] = useState<string[]>(groupId && src?.groupId === groupId ? src.options : []);

  const [internalName, setInternalName] = useState(src?.internalName ?? "");
  const [publicName, setPublicName] = useState(src?.publicName ?? "");
  const [code, setCode] = useState(src?.code ?? "");
  const [hsnCode, setHsnCode] = useState(src?.hsnCode ?? "");
  const [gstRate, setGstRate] = useState(src?.gstRate != null ? String(Number(src.gstRate)) : "5");
  const [draft, setDraft] = useState<SizeDraft>(() => draftFrom(src));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = {
      ...(groupId
        ? { options: options.map((o) => o.trim()), ...(!product && { groupId }) }
        : {
            internalName: internalName.trim(),
            publicName: publicName.trim(),
            hsnCode: hsnCode.trim() || null,
            gstRate: Number(gstRate),
          }),
      code: code.trim() || null,
      ...draftBody(draft, !product),
    };
    try {
      const saved = product
        ? await api<Product>(`/products/${product.id}`, "PATCH", body)
        : await api<Product>("/products", "POST", body);
      await mutate((k) => typeof k === "string" && (k.startsWith("/products") || k.startsWith("/product-groups")));
      // Edit returns to the page it came from; a new record replaces the "new" page.
      if (product) router.back();
      else router.replace(`/products/detail/?id=${saved.id}`);
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {groupId ? (
        <Card className="space-y-4 p-4">
          {!group ? (
            <Loading />
          ) : (
            <>
              <div>
                <h2 className="font-semibold">Size of {group.name}</h2>
                <p className="text-xs text-muted">
                  Name:{" "}
                  <strong>
                    {[group.name, ...options]
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .join(" ")}
                  </strong>{" "}
                  · on invoices: {group.publicName}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {group.dimensions.map((d, i) => (
                  <Field key={d} label={d}>
                    <Input
                      required
                      autoFocus={!product && i === 0}
                      value={options[i] ?? ""}
                      onChange={(e) =>
                        setOptions(group.dimensions.map((_, j) => (j === i ? e.target.value : options[j] ?? "")))
                      }
                    />
                  </Field>
                ))}
                <Field label="Code" hint="Optional, e.g. MN-15">
                  <Input value={code} onChange={(e) => setCode(e.target.value)} />
                </Field>
              </div>
              {!product && template && (
                <p className="text-xs text-muted">
                  Copied from {template.internalName}. Change the size and whatever differs.
                </p>
              )}
            </>
          )}
        </Card>
      ) : (
        <Card className="space-y-4 p-4">
          <Field label="Product name (for you)" hint="Full details, e.g. Maida Noodles 1.5mm 10×500g">
            <Input
              required
              value={internalName}
              onChange={(e) => setInternalName(e.target.value)}
              autoFocus={!product}
            />
          </Field>
          <Field label="Name on invoices" hint="What buyers see, e.g. Mahadeva Noodles. Internal details stay hidden.">
            <Input required value={publicName} onChange={(e) => setPublicName(e.target.value)} />
          </Field>
          <Field label="Code" hint="Optional, e.g. MN-15">
            <Input value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
        </Card>
      )}

      <SizeSections
        draft={draft}
        set={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        materials={materials}
        variant="cards"
        opening={!product}
        gst={
          groupId ? undefined : (
            <GstFields
              hsnCode={hsnCode}
              gstRate={gstRate}
              onChange={(p) => {
                if (p.hsnCode !== undefined) setHsnCode(p.hsnCode);
                if (p.gstRate !== undefined) setGstRate(p.gstRate);
              }}
            />
          )
        }
      />
      {group && (
        <p className="text-xs text-muted">
          HSN {group.hsnCode ?? "—"} and GST {group.gstRate !== null ? `${Number(group.gstRate)}%` : "—"} are shared by
          every size of {group.name}.
        </p>
      )}

      <ErrorBox error={error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={saving}>
          {saving ? "Saving…" : product ? "Save changes" : "Add product"}
        </Button>
      </div>
    </form>
  );
}
