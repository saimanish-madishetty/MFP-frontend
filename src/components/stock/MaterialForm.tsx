"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { todayIST } from "@/lib/format";
import { UNITS, unitShort, type Material, type MaterialType, type Unit } from "@/lib/stock";
import { Button, Card, ErrorBox, Field, Input, Segmented, Select, Textarea } from "@/components/ui";

export function MaterialForm({ material, defaultType }: { material?: Material; defaultType?: MaterialType }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [name, setName] = useState(material?.name ?? "");
  const [type, setType] = useState<MaterialType>(material?.type ?? defaultType ?? "RAW");
  const [unit, setUnit] = useState<Unit>(material?.unit ?? (defaultType === "SUPPLY" ? "PCS" : "KG"));
  const [lowStockLevel, setLowStockLevel] = useState(material?.lowStockLevel ?? "");
  const [notes, setNotes] = useState(material?.notes ?? "");
  const [openingQty, setOpeningQty] = useState("");
  const [openingCost, setOpeningCost] = useState("");
  const [openingDate, setOpeningDate] = useState(todayIST());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = {
      name: name.trim(),
      type,
      unit,
      lowStockLevel: lowStockLevel === "" ? null : Number(lowStockLevel),
      notes: notes.trim() || undefined,
      ...(!material && {
        openingQty: openingQty === "" ? undefined : Number(openingQty),
        openingCostPerUnit: openingCost === "" ? undefined : Number(openingCost),
        openingDate,
      }),
    };
    try {
      const saved = material
        ? await api<Material>(`/materials/${material.id}`, "PATCH", body)
        : await api<Material>("/materials", "POST", body);
      await mutate((k) => typeof k === "string" && (k.startsWith("/materials") || k.startsWith("/stock")));
      // Edit returns to the details page it came from; a new record replaces the "new" page.
      if (material) router.back();
      else router.replace(`/stock/detail/?id=${saved.id}`);
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card className="space-y-4 p-4">
        <Segmented<MaterialType>
          value={type}
          onChange={setType}
          options={[
            { value: "RAW", label: "Raw material" },
            { value: "SUPPLY", label: "Supply / packaging" },
          ]}
        />
        <Field label="Name" hint={type === "RAW" ? "e.g. Maida, Salt, Palm oil" : "e.g. Pouch 500g, Carton 24x, Label"}>
          <Input required value={name} onChange={(e) => setName(e.target.value)} autoFocus={!material} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Measured in">
            <Select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={`Low stock alert (${unitShort(unit)})`} hint="Optional">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={lowStockLevel}
              onChange={(e) => setLowStockLevel(e.target.value)}
            />
          </Field>
        </div>
        {material && <p className="text-xs text-muted">The unit can&apos;t be changed once stock has been recorded.</p>}
      </Card>

      {!material && (
        <Card className="space-y-4 p-4">
          <div>
            <h2 className="font-semibold">Current stock</h2>
            <p className="text-xs text-muted">How much you have right now. Leave blank if none.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={`Quantity (${unitShort(unit)})`}>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={openingQty}
                onChange={(e) => setOpeningQty(e.target.value)}
              />
            </Field>
            <Field label={`Cost per ${unitShort(unit)} (₹)`} hint="Optional">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={openingCost}
                onChange={(e) => setOpeningCost(e.target.value)}
              />
            </Field>
          </div>
          {openingQty !== "" && (
            <Field label="Counted on">
              <Input type="date" max={todayIST()} value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} />
            </Field>
          )}
        </Card>
      )}

      <Card className="p-4">
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </Card>

      <ErrorBox error={error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={saving}>
          {saving ? "Saving…" : material ? "Save changes" : "Add material"}
        </Button>
      </div>
    </form>
  );
}
