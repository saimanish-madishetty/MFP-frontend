"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import type { Product } from "@/lib/products";
import type { MaterialListItem } from "@/lib/stock";
import { Button, ErrorBox, Field, Input, Sheet } from "@/components/ui";
import { SizeSections } from "./SizeSections";
import { draftBody, draftFrom, type SizeDraft } from "./size-draft";

/**
 * "+ New size" from a size picker (sales, production, products list): a short form for one more size
 * of a product. Starts blank on purpose (nothing copied from another size, so nothing slips through
 * unchecked). Saves it and hands the new size back, ready to use.
 */
export function QuickSizeSheet({
  group,
  onClose,
  onCreated,
}: {
  group: { id: number; name: string; dimensions: string[] };
  onClose: () => void;
  onCreated: (size: Product) => void;
}) {
  const { mutate } = useSWRConfig();
  const { data: materials } = useSWR<MaterialListItem[]>("/materials?includeInactive=true");
  const [options, setOptions] = useState<string[]>(() => group.dimensions.map(() => ""));
  const [draft, setDraft] = useState<SizeDraft>(() => draftFrom());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // the sheet sits inside the sale / production form
    setSaving(true);
    setError(null);
    try {
      const saved = await api<Product>("/products", "POST", {
        groupId: group.id,
        options: options.map((o) => o.trim()),
        ...draftBody(draft, false),
      });
      await mutate((k) => typeof k === "string" && (k.startsWith("/products") || k.startsWith("/product-groups")));
      onCreated(saved);
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  // On the page body, not inside the sale / production form it was opened from (no form in a form).
  return createPortal(
    <Sheet open title={`New size of ${group.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {group.dimensions.map((dim, i) => (
            <Field key={dim} label={dim}>
              <Input
                required
                autoFocus={i === 0}
                value={options[i]}
                onChange={(e) => setOptions((o) => o.map((v, j) => (j === i ? e.target.value : v)))}
              />
            </Field>
          ))}
        </div>
        <SizeSections
          draft={draft}
          set={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          materials={materials}
          variant="compact"
        />
        <ErrorBox error={error} />
        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Add size"}
          </Button>
        </div>
      </form>
    </Sheet>,
    document.body
  );
}
