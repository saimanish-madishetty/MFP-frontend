"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { GST_RATES, guessSizes, type Product, type ProductGroup } from "@/lib/products";
import { Button, Card, ErrorBox, Field, Input, Loading, Select } from "@/components/ui";

type Member = { productId: number; options: string[] };

const sizeName = (name: string, options: string[]) =>
  [name, ...options].map((s) => s.trim()).filter(Boolean).join(" ");

/** Words two names start with in common (case-insensitive). */
function sharedStart(a: string, b: string) {
  const x = a.toLowerCase().split(/\s+/);
  const y = b.toLowerCase().split(/\s+/);
  let n = 0;
  while (n < x.length && n < y.length && x[n] === y[n]) n++;
  return n;
}

/**
 * Makes or edits a product with sizes. New: starts from one product (`fromId`), suggests similar
 * ones, and guesses the name and sizes from their names until you change them yourself.
 */
export function GroupForm({ group, fromId }: { group?: ProductGroup; fromId?: number }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: products } = useSWR<Product[]>("/products?includeInactive=true");
  const [state, setState] = useState<{
    name: string;
    publicName: string;
    hsnCode: string;
    gstRate: string;
    dimensions: string[];
    members: Member[];
    /** Set once the name or sizes are typed in; until then they're guessed from the product names */
    touched: boolean;
  } | null>(
    group
      ? {
          name: group.name,
          publicName: group.publicName,
          hsnCode: group.hsnCode ?? "",
          gstRate: group.gstRate !== null ? String(Number(group.gstRate)) : "5",
          dimensions: group.dimensions,
          members: group.products.map((p) => ({ productId: p.id, options: p.options })),
          touched: true,
        }
      : null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (!products) return <Loading />;
  const byId = new Map(products.map((p) => [p.id, p]));

  /** Re-guesses the name and sizes from the members' product names. */
  const guessed = (members: number[], base: NonNullable<typeof state>) => {
    const g = guessSizes(members.map((id) => byId.get(id)?.internalName ?? ""));
    return {
      ...base,
      name: g.name || base.name,
      dimensions: g.dimensions,
      members: members.map((productId, i) => ({ productId, options: g.options[i] })),
    };
  };

  // A new group starts from the product it was made from.
  if (!state) {
    const from = fromId ? byId.get(fromId) : undefined;
    const start = {
      name: from?.internalName ?? "",
      publicName: from?.publicName ?? "",
      hsnCode: from?.hsnCode ?? "",
      gstRate: from?.gstRate != null ? String(Number(from.gstRate)) : "5",
      dimensions: ["Size"],
      members: from ? [{ productId: from.id, options: [""] }] : [],
      touched: false,
    };
    setState(from ? guessed([from.id], start) : start);
    return <Loading />;
  }

  const s = state;
  const set = (patch: Partial<typeof s>) => setState({ ...s, ...patch });
  const touch = (patch: Partial<typeof s>) => setState({ ...s, ...patch, touched: true });
  const memberIds = new Set(s.members.map((m) => m.productId));

  const addMember = (id: number) => {
    const ids = [...s.members.map((m) => m.productId), id];
    if (!s.touched) setState(guessed(ids, s));
    else set({ members: [...s.members, { productId: id, options: s.dimensions.map(() => "") }] });
  };
  const removeMember = (id: number) => {
    const ids = s.members.map((m) => m.productId).filter((x) => x !== id);
    if (!s.touched && ids.length > 0) setState(guessed(ids, s));
    else set({ members: s.members.filter((m) => m.productId !== id) });
  };

  // Products that can be added: on their own (or already in this group), not yet listed.
  const free = products.filter(
    (p) => !memberIds.has(p.id) && (p.groupId === null || p.groupId === group?.id) && p.active,
  );
  const first = byId.get(s.members[0]?.productId);
  const similar = first
    ? free.filter((p) => sharedStart(p.internalName, first.internalName) >= Math.min(2, first.internalName.split(/\s+/).length))
    : [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = {
      name: s.name.trim(),
      publicName: s.publicName.trim(),
      hsnCode: s.hsnCode.trim() || null,
      gstRate: Number(s.gstRate),
      dimensions: s.dimensions.map((d) => d.trim()),
      members: s.members,
    };
    try {
      const saved = group
        ? await api<ProductGroup>(`/product-groups/${group.id}`, "PUT", body)
        : await api<ProductGroup>("/product-groups", "POST", body);
      await mutate((k) => typeof k === "string" && (k.startsWith("/products") || k.startsWith("/product-groups")));
      router.replace(`/products/group/?id=${saved.id}`);
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  const splitUp = async () => {
    if (!group || !confirm(`Split ${group.name} into separate products? Their names, stock and history stay.`)) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/product-groups/${group.id}`, "DELETE");
      await mutate((k) => typeof k === "string" && (k.startsWith("/products") || k.startsWith("/product-groups")));
      router.replace("/products/");
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card className="space-y-4 p-4">
        <Field label="Product name (for you)" hint="Without the size, e.g. Mahadeva Maida Noodles">
          <Input required value={s.name} onChange={(e) => touch({ name: e.target.value })} />
        </Field>
        <Field label="Name on invoices" hint="Same for every size, e.g. Mahadeva Noodles">
          <Input required value={s.publicName} onChange={(e) => set({ publicName: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="HSN code">
            <Input value={s.hsnCode} onChange={(e) => set({ hsnCode: e.target.value })} />
          </Field>
          <Field label="GST rate">
            <Select value={s.gstRate} onChange={(e) => set({ gstRate: e.target.value })}>
              {GST_RATES.map((r) => (
                <option key={r} value={r}>
                  {r}%
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div>
          <h2 className="font-semibold">What changes between sizes</h2>
          <p className="text-xs text-muted">e.g. Thickness and Weight. Packing, price, recipe and stock are set per size.</p>
        </div>
        {s.dimensions.map((d, i) => (
          <div key={i} className="flex gap-2">
            <Input
              required
              placeholder="e.g. Thickness"
              value={d}
              onChange={(e) => touch({ dimensions: s.dimensions.map((x, j) => (j === i ? e.target.value : x)) })}
            />
            {s.dimensions.length > 1 && (
              <button
                type="button"
                aria-label={`Remove ${d}`}
                onClick={() =>
                  touch({
                    dimensions: s.dimensions.filter((_, j) => j !== i),
                    members: s.members.map((m) => ({ ...m, options: m.options.filter((_, j) => j !== i) })),
                  })
                }
                className="rounded p-1 text-muted hover:bg-surface-2"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {s.dimensions.length < 4 && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              touch({
                dimensions: [...s.dimensions, ""],
                members: s.members.map((m) => ({ ...m, options: [...m.options, ""] })),
              })
            }
          >
            + Add
          </Button>
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <div>
          <h2 className="font-semibold">Sizes</h2>
          <p className="text-xs text-muted">
            Each size keeps its stock, sales and history. Its name becomes the product name plus its values.
          </p>
        </div>
        {s.members.map((m) => {
          const p = byId.get(m.productId);
          const next = sizeName(s.name, m.options);
          return (
            <div key={m.productId} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 text-sm">
                  <p className="truncate font-medium">{next || "?"}</p>
                  {p && p.internalName !== next && <p className="truncate text-xs text-muted">Now: {p.internalName}</p>}
                </div>
                <button
                  type="button"
                  aria-label="Remove size"
                  onClick={() => removeMember(m.productId)}
                  className="rounded p-1 text-muted hover:bg-surface-2"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {s.dimensions.map((d, i) => (
                  <Field key={i} label={d || `Value ${i + 1}`}>
                    <Input
                      required
                      list={`dim-${i}`}
                      value={m.options[i] ?? ""}
                      onChange={(e) =>
                        touch({
                          members: s.members.map((x) =>
                            x.productId === m.productId
                              ? { ...x, options: s.dimensions.map((_, j) => (j === i ? e.target.value : (x.options[j] ?? ""))) }
                              : x,
                          ),
                        })
                      }
                    />
                  </Field>
                ))}
              </div>
            </div>
          );
        })}
        {s.dimensions.map((_, i) => (
          <datalist key={i} id={`dim-${i}`}>
            {[...new Set(s.members.map((m) => m.options[i]).filter(Boolean))].map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        ))}
        {similar.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted">Look similar, tap to add as sizes:</p>
            <div className="flex flex-wrap gap-2">
              {similar.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addMember(p.id)}
                  className="rounded-full border border-brand/50 bg-brand/5 px-3 py-1 text-sm hover:border-brand"
                >
                  + {p.internalName}
                </button>
              ))}
            </div>
          </div>
        )}
        {free.length > 0 && (
          <Select searchable value="" onChange={(e) => e.target.value && addMember(Number(e.target.value))}>
            <option value="">+ Add another existing product as a size…</option>
            {free.map((p) => (
              <option key={p.id} value={p.id}>
                {p.internalName}
              </option>
            ))}
          </Select>
        )}
        {group && <p className="text-xs text-muted">To add a brand-new size, save and use + Add size.</p>}
      </Card>

      <ErrorBox error={error} />
      <div className="flex flex-wrap justify-end gap-2">
        {group && (
          <Button type="button" variant="ghost" onClick={splitUp} disabled={saving} className="mr-auto">
            Split into separate products
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={saving || s.members.length === 0}>
          {saving ? "Saving…" : group ? "Save changes" : "Make product with sizes"}
        </Button>
      </div>
    </form>
  );
}
