"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import type { ProductGroup } from "@/lib/products";
import type { MaterialListItem } from "@/lib/stock";
import { Button, Card, ErrorBox, Field, Input } from "@/components/ui";
import { GstFields } from "./ProductForm";
import { SizeSections } from "./SizeSections";
import { draftBody, draftFrom, draftMissing, draftSummary, type SizeDraft } from "./size-draft";

type SizeTile = { key: number; options: string[]; draft: SizeDraft };

let nextKey = 1;

/**
 * A new product made in several sizes. The product (names, HSN, GST) and what varies are entered
 * once; each size is a tile with its own values, packing, price, materials and ready stock.
 * Only one tile is open at a time; closed tiles show a one-line summary.
 */
export function MultiSizeForm() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: materials } = useSWR<MaterialListItem[]>("/materials?includeInactive=true");

  const [name, setName] = useState("");
  const [publicName, setPublicName] = useState("");
  const [hsnCode, setHsnCode] = useState("");
  const [gstRate, setGstRate] = useState("5");
  const [dims, setDims] = useState<string[]>([""]);
  const [sizes, setSizes] = useState<SizeTile[]>(() => [{ key: nextKey++, options: [""], draft: draftFrom() }]);
  const [openKey, setOpenKey] = useState<number | null>(sizes[0].key);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const setTile = (key: number, fn: (t: SizeTile) => SizeTile) =>
    setSizes((prev) => prev.map((t) => (t.key === key ? fn(t) : t)));

  const label = (t: SizeTile, n: number) =>
    t.options.some((o) => o.trim()) ? t.options.map((o) => o.trim() || "?").join(" · ") : `Size ${n + 1}`;
  const missing = (t: SizeTile) => [
    ...dims.flatMap((d, i) => (t.options[i]?.trim() ? [] : [d.trim() || `value ${i + 1}`])),
    ...draftMissing(t.draft),
  ];

  const addSize = (copy: boolean) => {
    const last = sizes[sizes.length - 1];
    const tile: SizeTile = {
      key: nextKey++,
      options: dims.map(() => ""),
      // A copy keeps the last size's packing, price and materials; values and ready stock start empty.
      draft: copy && last ? { ...structuredClone(last.draft), openingQty: "" } : draftFrom(),
    };
    setSizes((prev) => [...prev, tile]);
    setOpenKey(tile.key);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Closed tiles aren't checked by the browser: open the first incomplete one.
    const incomplete = sizes.find((t) => missing(t).length > 0);
    if (incomplete) {
      setOpenKey(incomplete.key);
      setError(new Error(`${label(incomplete, sizes.indexOf(incomplete))}: fill in ${missing(incomplete).join(", ")}`));
      return;
    }
    setSaving(true);
    const body = {
      name: name.trim(),
      publicName: publicName.trim(),
      hsnCode: hsnCode.trim() || null,
      gstRate: Number(gstRate),
      dimensions: dims.map((d) => d.trim()),
      members: [],
      sizes: sizes.map((t) => ({ options: t.options.map((o) => o.trim()), ...draftBody(t.draft, true) })),
    };
    try {
      const saved = await api<ProductGroup>("/product-groups", "POST", body);
      await mutate((k) => typeof k === "string" && (k.startsWith("/products") || k.startsWith("/product-groups")));
      router.replace(`/products/group/?id=${saved.id}`);
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 pb-24">
      <Card className="space-y-4 p-4">
        <Field label="Product name (without the size)" hint="e.g. Mahadeva Maida Noodles. Each size adds its values.">
          <Input required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Name on invoices" hint="What buyers see, e.g. Mahadeva Noodles. Same for every size.">
          <Input required value={publicName} onChange={(e) => setPublicName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <GstFields
            hsnCode={hsnCode}
            gstRate={gstRate}
            onChange={(p) => {
              if (p.hsnCode !== undefined) setHsnCode(p.hsnCode);
              if (p.gstRate !== undefined) setGstRate(p.gstRate);
            }}
          />
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div>
          <h2 className="font-semibold">What varies</h2>
          <p className="text-xs text-muted">What makes one size different from another, e.g. Thickness, Weight.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dims.map((d, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input
                required
                aria-label={`What varies ${i + 1}`}
                placeholder={i === 0 ? "e.g. Thickness" : "e.g. Weight"}
                value={d}
                onChange={(e) => setDims(dims.map((x, j) => (j === i ? e.target.value : x)))}
                className="w-36"
              />
              {dims.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remove ${d || "this"}`}
                  onClick={() => {
                    setDims(dims.filter((_, j) => j !== i));
                    setSizes((prev) => prev.map((t) => ({ ...t, options: t.options.filter((_, j) => j !== i) })));
                  }}
                  className="rounded p-1 text-muted hover:bg-surface-2"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {dims.length < 4 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setDims([...dims, ""]);
                setSizes((prev) => prev.map((t) => ({ ...t, options: [...t.options, ""] })));
              }}
            >
              + Add
            </Button>
          )}
        </div>
      </Card>

      <div className="space-y-2">
        <h2 className="px-1 font-semibold">
          Sizes <span className="text-sm font-normal text-muted">({sizes.length})</span>
        </h2>
        {sizes.map((t, n) => {
          const open = openKey === t.key;
          const todo = missing(t);
          const fullName = [name, ...t.options]
            .map((x) => x.trim())
            .filter(Boolean)
            .join(" ");
          return (
            <Card key={t.key} className={open ? "border-brand" : ""}>
              <div className="flex items-start gap-2 p-3">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenKey(open ? null : t.key)}
                  className="flex min-w-0 flex-1 items-start gap-2 text-left"
                >
                  <span className="mt-0.5 w-4 shrink-0 text-muted">{open ? "▾" : "▸"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{label(t, n)}</span>
                    <span
                      className={`block truncate text-xs ${
                        todo.length > 0 && !open ? "text-amber-600 dark:text-amber-400" : "text-muted"
                      }`}
                    >
                      {todo.length > 0 && !open ? `Missing: ${todo.join(", ")}` : draftSummary(t.draft)}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-sm ${
                      todo.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-700 dark:text-green-400"
                    }`}
                    aria-label={todo.length > 0 ? "Incomplete" : "Complete"}
                  >
                    {todo.length > 0 ? "⚠" : "✓"}
                  </span>
                </button>
                {sizes.length > 1 && (
                  <button
                    type="button"
                    aria-label="Remove size"
                    onClick={() => setSizes((prev) => prev.filter((x) => x.key !== t.key))}
                    className="rounded p-1 text-muted hover:bg-surface-2"
                  >
                    ✕
                  </button>
                )}
              </div>
              {open && (
                <div className="space-y-4 px-3 pb-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {dims.map((d, i) => (
                      <Field key={i} label={d.trim() || `Value ${i + 1}`}>
                        <Input
                          required
                          list={`varies-${i}`}
                          value={t.options[i] ?? ""}
                          onChange={(e) =>
                            setTile(t.key, (x) => ({
                              ...x,
                              options: dims.map((_, j) => (j === i ? e.target.value : x.options[j] ?? "")),
                            }))
                          }
                        />
                      </Field>
                    ))}
                  </div>
                  {fullName && <p className="text-xs text-muted">Name: {fullName}</p>}
                  <SizeSections
                    draft={t.draft}
                    set={(patch) => setTile(t.key, (x) => ({ ...x, draft: { ...x.draft, ...patch } }))}
                    materials={materials}
                    variant="tile"
                    opening
                  />
                </div>
              )}
            </Card>
          );
        })}
        {dims.map((_, i) => (
          <datalist key={i} id={`varies-${i}`}>
            {[...new Set(sizes.map((t) => t.options[i]?.trim()).filter(Boolean))].map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => addSize(true)}>
            + Copy last size
          </Button>
          <Button type="button" variant="ghost" onClick={() => addSize(false)}>
            + Add blank size
          </Button>
        </div>
        <p className="px-1 text-xs text-muted">
          Copy last size keeps its packing, price and materials, so you only change what differs.
        </p>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 pt-3 pb-safe-bottom backdrop-blur md:left-60">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <ErrorBox error={error} />
          </div>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? "Saving…" : `Save product (${sizes.length} size${sizes.length === 1 ? "" : "s"})`}
          </Button>
        </div>
      </div>
    </form>
  );
}
