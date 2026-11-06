"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { formatINR, todayIST } from "@/lib/format";
import { GST_RATES, packFor, perUnit, unitFactor, unitSingular, type Product, type ProductGroup } from "@/lib/products";
import { UNITS, formatQty, unitShort, type MaterialListItem, type Unit } from "@/lib/stock";
import { Button, Card, ErrorBox, Field, Input, Loading, Segmented, Select } from "@/components/ui";

type RecipeRow = { materialId: number; qty: string; perPiece: boolean };
type SpecRow = { key: string; value: string };
/** One size when adding a product in several sizes. `sizeTyped`: piece size typed, not taken from a Weight value. */
type SizeRow = {
  key: number;
  options: string[];
  packSize: string;
  sizeTyped: boolean;
  price: string;
  openingQty: string;
};

let nextSizeKey = 1;

const WEIGHT_UNITS: Record<string, { unit: Unit; per: number }> = {
  g: { unit: "G", per: 1 },
  gm: { unit: "G", per: 1 },
  gms: { unit: "G", per: 1 },
  kg: { unit: "G", per: 1000 },
  ml: { unit: "ML", per: 1 },
  l: { unit: "ML", per: 1000 },
  ltr: { unit: "ML", per: 1000 },
};

/**
 * Piece size from a size value like "500g", "1kg" or "500", in `unit` (G, KG, ML or L); null if it
 * isn't a weight/volume. A bare number counts only for a dimension named like Weight.
 */
function sizeFromValue(value: string, dimension: string, unit: Unit): string | null {
  const m = value.trim().match(/^(\d+(?:\.\d+)?)\s*([a-z]*)$/i);
  if (!m) return null;
  const n = Number(m[1]);
  const suffix = m[2].toLowerCase();
  if (!suffix) return /weight|wt|volume|qty|size/i.test(dimension) ? String(n) : null;
  const from = WEIGHT_UNITS[suffix];
  if (!from) return null;
  // To the chosen unit: grams → G (×1) or KG (÷1000), and the same for ml/L.
  const inBase = n * from.per;
  const to = unit === "KG" || unit === "L" ? 1000 : 1;
  return String(Math.round((inBase / to) * 1000) / 1000);
}

/** Units a product can be sold as (weights and volumes go in the size). */
const SALE_UNITS = UNITS.filter((u) => !["G", "ML", "METER", "ROLL"].includes(u.value));
const SIZE_UNITS = UNITS.filter((u) => ["G", "KG", "ML", "L"].includes(u.value));

/**
 * Add or edit a product. `template` pre-fills a new product from an existing one ("Duplicate"),
 * with every field copied (names and code too: the backend rejects an unchanged name or code).
 */
export function ProductForm({
  product,
  template,
  groupId: newInGroup,
}: {
  product?: Product;
  template?: Product;
  /** A new size of this product group */
  groupId?: number;
}) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: materials } = useSWR<MaterialListItem[]>("/materials?includeInactive=true");
  const src = product ?? template;
  // A size of a group: its names, HSN and GST come from the group; it has a value per dimension.
  const groupId = product ? product.groupId : newInGroup ?? null;
  const { data: group } = useSWR<ProductGroup>(groupId ? `/product-groups/${groupId}` : null);
  const [options, setOptions] = useState<string[]>(groupId && src?.groupId === groupId ? src.options : []);

  const [internalName, setInternalName] = useState(src?.internalName ?? "");
  const [publicName, setPublicName] = useState(src?.publicName ?? "");
  const [code, setCode] = useState(src?.code ?? "");
  const [saleUnit, setSaleUnit] = useState<Unit>(src?.saleUnit ?? "PACK");
  const [hasPieces, setHasPieces] = useState(src ? (src.piecesPerUnit ?? 0) > 1 : true);
  const [pieces, setPieces] = useState(src?.piecesPerUnit ? String(src.piecesPerUnit) : "");
  const [packSize, setPackSize] = useState(src?.packSize ? String(Number(src.packSize)) : "");
  const [packUnit, setPackUnit] = useState<Unit>(src?.packUnit ?? "G");
  // Price per unit sold (pack/bag) and per piece/kg; either may be blank (worked out from the other).
  const [price, setPrice] = useState(src?.price ?? "");
  const [piecePrice, setPiecePrice] = useState(src?.piecePrice ?? "");
  const [mrp, setMrp] = useState(src?.mrp ?? "");
  const [hsnCode, setHsnCode] = useState(src?.hsnCode ?? "");
  const [gstRate, setGstRate] = useState(
    src?.gstRate !== null && src?.gstRate !== undefined ? String(Number(src.gstRate)) : "5"
  );
  const [specs, setSpecs] = useState<SpecRow[]>(src?.specs?.length ? src.specs : [{ key: "", value: "" }]);
  const [recipe, setRecipe] = useState<RecipeRow[]>(
    src?.materials.map((m) => ({
      materialId: m.materialId,
      qty: m.qtyPerUnit ?? "",
      perPiece: m.perPiece,
    })) ?? []
  );
  const [openingQty, setOpeningQty] = useState("");
  const [openingDate, setOpeningDate] = useState(todayIST());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // A brand-new product can be added in several sizes at once (a product group).
  const canHaveSizes = !product && !groupId && !template;
  const [multi, setMulti] = useState(false);
  const [dims, setDims] = useState<string[]>(["Thickness", "Weight"]);
  const emptySize = (from?: SizeRow): SizeRow => ({
    key: nextSizeKey++,
    options: from ? [...from.options] : dims.map(() => ""),
    packSize: from?.packSize ?? "",
    sizeTyped: from?.sizeTyped ?? false,
    price: from?.price ?? "",
    openingQty: "",
  });
  const [sizes, setSizes] = useState<SizeRow[]>(() => [emptySize(), emptySize()]);
  const sizesMode = canHaveSizes && multi;

  const setSize = (key: number, patch: Partial<SizeRow>) =>
    setSizes((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  /** Typing a size value; a Weight like "500g" also fills the piece size (unless it was typed). */
  const setSizeValue = (row: SizeRow, i: number, value: string) => {
    const opts = dims.map((_, j) => (j === i ? value : row.options[j] ?? ""));
    const fromValue = row.sizeTyped
      ? null
      : opts.map((v, j) => sizeFromValue(v, dims[j], packUnit)).find((v) => v !== null) ?? null;
    setSize(row.key, {
      options: opts,
      ...(!row.sizeTyped && { packSize: fromValue ?? "" }),
    });
  };

  const piecesPerUnit = hasPieces && saleUnit !== "PCS" && Number(pieces) > 1 ? Math.round(Number(pieces)) : null;
  const size = packSize === "" ? null : Number(packSize);
  const pack = packFor({
    saleUnit,
    piecesPerUnit,
    packSize: size,
    packUnit: size ? packUnit : null,
  });
  const packed = { saleUnit, pack };
  const twoUnits = pack.units.length > 1;
  const per = unitFactor(packed, saleUnit); // e.g. 10 pieces per pack, 25 kg per bag
  const round2 = (n: number) => Math.round(n * 100) / 100;
  // A blank price is worked out from the other one, like the backend does.
  const pricePerSaleUnit =
    price !== "" ? Number(price) : twoUnits && piecePrice !== "" ? round2(Number(piecePrice) * per) : null;
  const derivedPiecePrice = price !== "" ? round2(Number(price) / per) : null;

  const byId = new Map(materials?.map((m) => [m.id, m]));
  const used = new Set(recipe.map((r) => r.materialId));
  const available = (materials ?? []).filter((m) => m.active && !used.has(m.id));

  const estimate = recipe.reduce(
    (acc, r) => {
      const m = byId.get(r.materialId);
      if (!m?.lastCostPerUnit || r.qty === "") return { ...acc, missing: true };
      const qty = Number(r.qty) * (r.perPiece && piecesPerUnit ? piecesPerUnit : 1);
      return { ...acc, total: acc.total + qty * Number(m.lastCostPerUnit) };
    },
    { total: 0, missing: false }
  );

  const recipeBody = () =>
    recipe.map((r) => ({
      materialId: r.materialId,
      qtyPerUnit: r.qty === "" ? null : Number(r.qty),
      perPiece: piecesPerUnit !== null && r.perPiece,
    }));

  /** Several sizes: one product group with a product per size, saved together. */
  const submitSizes = async () => {
    const body = {
      name: internalName.trim(),
      publicName: publicName.trim(),
      hsnCode: hsnCode.trim() || null,
      gstRate: Number(gstRate),
      dimensions: dims.map((d) => d.trim()),
      members: [],
      sizes: sizes.map((s) => ({
        options: s.options.map((o) => o.trim()),
        saleUnit,
        piecesPerUnit,
        packSize: s.packSize === "" ? null : Number(s.packSize),
        packUnit: s.packSize === "" ? null : packUnit,
        price: s.price === "" ? null : Number(s.price),
        specs: specs.filter((x) => x.key.trim()),
        materials: recipeBody(),
        openingQty: s.openingQty === "" ? undefined : Number(s.openingQty),
        openingDate,
      })),
    };
    const saved = await api<ProductGroup>("/product-groups", "POST", body);
    await mutate((k) => typeof k === "string" && (k.startsWith("/products") || k.startsWith("/product-groups")));
    router.replace(`/products/group/?id=${saved.id}`);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    if (sizesMode) {
      try {
        await submitSizes();
      } catch (err) {
        setError(err);
        setSaving(false);
      }
      return;
    }
    const body = {
      ...(groupId
        ? {
            options: options.map((o) => o.trim()),
            ...(!product && { groupId }),
          }
        : {
            internalName: internalName.trim(),
            publicName: publicName.trim(),
            hsnCode: hsnCode.trim() || null,
            gstRate: Number(gstRate),
          }),
      code: code.trim() || null,
      saleUnit,
      piecesPerUnit,
      packSize: size,
      packUnit: size ? packUnit : null,
      price: price === "" ? null : Number(price),
      piecePrice: twoUnits && piecePrice !== "" ? Number(piecePrice) : null,
      mrp: mrp === "" ? null : Number(mrp),
      specs: specs.filter((s) => s.key.trim()),
      materials: recipe.map((r) => ({
        materialId: r.materialId,
        qtyPerUnit: r.qty === "" ? null : Number(r.qty),
        perPiece: piecesPerUnit !== null && r.perPiece,
      })),
      ...(!product && {
        openingQty: openingQty === "" ? undefined : Number(openingQty),
        openingDate,
      }),
    };
    try {
      const saved = product
        ? await api<Product>(`/products/${product.id}`, "PATCH", body)
        : await api<Product>("/products", "POST", body);
      await mutate((k) => typeof k === "string" && k.startsWith("/products"));
      // Edit returns to the details page it came from; a new record replaces the "new" page.
      if (product) router.back();
      else router.replace(`/products/detail/?id=${saved.id}`);
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  const setRow = (id: number, patch: Partial<RecipeRow>) =>
    setRecipe((p) => p.map((x) => (x.materialId === id ? { ...x, ...patch } : x)));

  const recipeSection = (type: "RAW" | "SUPPLY") => {
    const rows = recipe.filter((r) => byId.get(r.materialId)?.type === type);
    const options = available.filter((m) => m.type === type);
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{type === "RAW" ? "Ingredients" : "Packaging & supplies"}</h3>
        {rows.length === 0 && <p className="text-xs text-muted">None added.</p>}
        {rows.map((r) => {
          const m = byId.get(r.materialId)!;
          return (
            <div key={r.materialId} className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm">{m.name}</span>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder="?"
                value={r.qty}
                onChange={(e) => setRow(r.materialId, { qty: e.target.value })}
                className="w-24 text-right"
              />
              <span className="w-12 text-xs text-muted">{unitShort(m.unit)}</span>
              {piecesPerUnit !== null && (
                <Select
                  aria-label="Quantity is per"
                  value={r.perPiece ? "piece" : "unit"}
                  onChange={(e) =>
                    setRow(r.materialId, {
                      perPiece: e.target.value === "piece",
                    })
                  }
                  className="w-auto"
                >
                  <option value="unit">{perUnit(saleUnit)}</option>
                  <option value="piece">per piece</option>
                </Select>
              )}
              <button
                type="button"
                aria-label="Remove"
                onClick={() => setRecipe((p) => p.filter((x) => x.materialId !== r.materialId))}
                className="rounded p-1 text-muted hover:bg-surface-2"
              >
                ✕
              </button>
            </div>
          );
        })}
        {options.length > 0 && (
          <Select
            value=""
            onChange={(e) =>
              e.target.value &&
              setRecipe((p) => [
                ...p,
                {
                  materialId: Number(e.target.value),
                  qty: "",
                  perPiece: false,
                },
              ])
            }
          >
            <option value="">+ Add {type === "RAW" ? "ingredient" : "packaging"}…</option>
            {options.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        )}
      </div>
    );
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
          {canHaveSizes && (
            <div className="space-y-1">
              <Segmented<"one" | "many">
                value={multi ? "many" : "one"}
                onChange={(v) => setMulti(v === "many")}
                options={[
                  { value: "one", label: "One size" },
                  { value: "many", label: "Several sizes" },
                ]}
              />
              <p className="text-xs text-muted">
                {multi
                  ? "e.g. Maida Noodles in 1.5mm and 1.8mm, 500g and 550g: one product, a row per size."
                  : "Comes in different thickness or weight? Choose Several sizes."}
              </p>
            </div>
          )}
          <Field
            label={sizesMode ? "Product name (without the size)" : "Product name (for you)"}
            hint={
              sizesMode
                ? "e.g. Mahadeva Maida Noodles. Each size adds its values to this."
                : "Full details, e.g. Maida Noodles 1.5mm 10×500g"
            }
          >
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
          {!sizesMode && (
            <Field label="Code" hint="Optional, e.g. MN-15">
              <Input value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
          )}
        </Card>
      )}

      <Card className="space-y-4 p-4">
        <div>
          <h2 className="font-semibold">Packing</h2>
          <p className="text-xs text-muted">
            {sizesMode
              ? "How one unit you sell is packed, the same for every size. The piece size is set per size below."
              : "How one unit you sell is packed."}
          </p>
        </div>
        <Field label="Sold as">
          <Select value={saleUnit} onChange={(e) => setSaleUnit(e.target.value as Unit)}>
            {SALE_UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </Select>
        </Field>
        {saleUnit !== "PCS" && (
          <Segmented<"pieces" | "single">
            value={hasPieces ? "pieces" : "single"}
            onChange={(v) => setHasPieces(v === "pieces")}
            options={[
              { value: "pieces", label: "Pieces inside" },
              { value: "single", label: "Single packing" },
            ]}
          />
        )}
        <div className="grid grid-cols-2 gap-4">
          {hasPieces && saleUnit !== "PCS" && (
            <Field label={`Pieces per ${unitSingular(saleUnit)}`} hint="e.g. 10">
              <Input
                type="number"
                inputMode="numeric"
                min={2}
                step={1}
                required
                value={pieces}
                onChange={(e) => setPieces(e.target.value)}
              />
            </Field>
          )}
          {sizesMode ? (
            <Field label={hasPieces && saleUnit !== "PCS" ? "Piece size in" : "Size in"}>
              <Select value={packUnit} onChange={(e) => setPackUnit(e.target.value as Unit)}>
                {SIZE_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.short}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field
              label={hasPieces && saleUnit !== "PCS" ? "Each piece" : "Size"}
              hint={
                hasPieces && saleUnit !== "PCS" ? "e.g. 500 g" : `Optional, e.g. 25 kg per ${unitSingular(saleUnit)}`
              }
            >
              <div className="flex gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={packSize}
                  onChange={(e) => setPackSize(e.target.value)}
                />
                <Select value={packUnit} onChange={(e) => setPackUnit(e.target.value as Unit)} className="max-w-24">
                  {SIZE_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.short}
                    </option>
                  ))}
                </Select>
              </div>
            </Field>
          )}
        </div>
        {!sizesMode && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
            <strong>{pack.description}</strong>
            {pack.units.length > 1 && (
              <span className="text-muted">
                {" "}
                · sell by {unitSingular(saleUnit)} or by {unitSingular(pack.stockUnit)}
              </span>
            )}
          </p>
        )}
      </Card>

      {sizesMode && (
        <Card className="space-y-4 p-4">
          <div>
            <h2 className="font-semibold">Sizes</h2>
            <p className="text-xs text-muted">What changes between sizes, then a row per size you make.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {dims.map((d, i) => (
              <div key={i} className="flex items-center gap-1">
                <Input
                  required
                  aria-label={`Dimension ${i + 1}`}
                  placeholder="e.g. Thickness"
                  value={d}
                  onChange={(e) => setDims(dims.map((x, j) => (j === i ? e.target.value : x)))}
                  className="w-32"
                />
                {dims.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Remove ${d}`}
                    onClick={() => {
                      setDims(dims.filter((_, j) => j !== i));
                      setSizes((prev) =>
                        prev.map((s) => ({
                          ...s,
                          options: s.options.filter((_, j) => j !== i),
                        }))
                      );
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
                  setSizes((prev) => prev.map((s) => ({ ...s, options: [...s.options, ""] })));
                }}
              >
                + Add
              </Button>
            )}
          </div>

          {sizes.map((s, n) => {
            const name = [internalName, ...s.options]
              .map((x) => x.trim())
              .filter(Boolean)
              .join(" ");
            const rowPack = packFor({
              saleUnit,
              piecesPerUnit,
              packSize: s.packSize === "" ? null : Number(s.packSize),
              packUnit: s.packSize === "" ? null : packUnit,
            });
            return (
              <div key={s.key} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium">{name || `Size ${n + 1}`}</p>
                    <p className="text-xs text-muted">{rowPack.description}</p>
                  </div>
                  {sizes.length > 1 && (
                    <button
                      type="button"
                      aria-label="Remove size"
                      onClick={() => setSizes((prev) => prev.filter((x) => x.key !== s.key))}
                      className="rounded p-1 text-muted hover:bg-surface-2"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {dims.map((d, i) => (
                    <Field key={i} label={d || `Value ${i + 1}`}>
                      <Input
                        required
                        list={`size-dim-${i}`}
                        placeholder={
                          d.toLowerCase().includes("thick") ? "e.g. 1.5mm" : /weight/i.test(d) ? "e.g. 500g" : undefined
                        }
                        value={s.options[i] ?? ""}
                        onChange={(e) => setSizeValue(s, i, e.target.value)}
                      />
                    </Field>
                  ))}
                  <Field label={`${hasPieces && saleUnit !== "PCS" ? "Piece" : "Size"} (${unitShort(packUnit)})`}>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      required={hasPieces && saleUnit !== "PCS"}
                      value={s.packSize}
                      onChange={(e) =>
                        setSize(s.key, {
                          packSize: e.target.value,
                          sizeTyped: e.target.value !== "",
                        })
                      }
                    />
                  </Field>
                  <Field label={`Price ₹ ${perUnit(saleUnit)}`}>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      required
                      value={s.price}
                      onChange={(e) => setSize(s.key, { price: e.target.value })}
                    />
                  </Field>
                  <Field label={`Ready now (${unitShort(saleUnit)})`}>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      placeholder="0"
                      value={s.openingQty}
                      onChange={(e) => setSize(s.key, { openingQty: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            );
          })}
          {dims.map((_, i) => (
            <datalist key={i} id={`size-dim-${i}`}>
              {[...new Set(sizes.map((s) => s.options[i]?.trim()).filter(Boolean))].map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setSizes((prev) => [...prev, emptySize(prev[prev.length - 1])])}
            >
              + Add size
            </Button>
            {sizes.some((s) => s.openingQty !== "") && (
              <label className="flex items-center gap-2 text-sm">
                Counted on
                <Input
                  type="date"
                  max={todayIST()}
                  value={openingDate}
                  onChange={(e) => setOpeningDate(e.target.value)}
                />
              </label>
            )}
          </div>
          <p className="text-xs text-muted">
            + Add size copies the row above. Price per piece, MRP and code can be set on each size afterwards.
          </p>
        </Card>
      )}

      <Card className="space-y-4 p-4">
        <div>
          <h2 className="font-semibold">{sizesMode ? "GST" : "Price & GST"}</h2>
          {twoUnits && !sizesMode && (
            <p className="text-xs text-muted">
              Fill one or both. A blank price is worked out from the other, e.g. {perUnit(pack.stockUnit)} ={" "}
              {perUnit(saleUnit)} ÷ {formatQty(per)}.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {!sizesMode && (
            <>
              <Field
                label={`Selling price ${perUnit(saleUnit)} (₹)`}
                hint={
                  twoUnits && price === "" && pricePerSaleUnit !== null
                    ? `Blank = ${formatINR(pricePerSaleUnit)} (from ${perUnit(pack.stockUnit)} price)`
                    : undefined
                }
              >
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  required={!twoUnits || piecePrice === ""}
                  placeholder={
                    twoUnits && pricePerSaleUnit !== null && price === "" ? String(pricePerSaleUnit) : undefined
                  }
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </Field>
              {twoUnits && (
                <Field
                  label={`Selling price ${perUnit(pack.stockUnit)} (₹)`}
                  hint={
                    piecePrice === "" && derivedPiecePrice !== null
                      ? `Blank = ${formatINR(derivedPiecePrice)} (from ${perUnit(saleUnit)} price)`
                      : undefined
                  }
                >
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    required={price === ""}
                    placeholder={
                      derivedPiecePrice !== null && piecePrice === "" ? String(derivedPiecePrice) : undefined
                    }
                    value={piecePrice}
                    onChange={(e) => setPiecePrice(e.target.value)}
                  />
                </Field>
              )}
              <Field label="MRP (₹)" hint="Optional">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={mrp}
                  onChange={(e) => setMrp(e.target.value)}
                />
              </Field>
            </>
          )}
          {!groupId && (
            <>
              <Field label="HSN code" hint="e.g. 1902 for noodles">
                <Input value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} />
              </Field>
              <Field label="GST rate">
                <Select value={gstRate} onChange={(e) => setGstRate(e.target.value)}>
                  {GST_RATES.map((r) => (
                    <option key={r} value={r}>
                      {r}%
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          )}
        </div>
        {group && (
          <p className="text-xs text-muted">
            HSN {group.hsnCode ?? "—"} and GST {group.gstRate !== null ? `${Number(group.gstRate)}%` : "—"} are shared
            by every size of {group.name}.
          </p>
        )}
      </Card>

      <Card className="space-y-4 p-4">
        <div>
          <h2 className="font-semibold">Materials used {perUnit(saleUnit)}</h2>
          <p className="text-xs text-muted">
            Quantities can be filled in later. Used for cost estimates.
            {piecesPerUnit !== null && " Choose per piece for things like pouches, per pack for the outer bag."}
            {sizesMode && " Copied to every size; adjust each size's recipe afterwards if they differ."}
          </p>
        </div>
        {recipeSection("RAW")}
        {recipeSection("SUPPLY")}
        {recipe.length > 0 && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
            Estimated material cost {perUnit(saleUnit)}:{" "}
            <strong>{formatINR(Math.round(estimate.total * 100) / 100)}</strong>
            {estimate.missing && <span className="text-muted"> (some quantities or prices missing)</span>}
            {pricePerSaleUnit !== null && !estimate.missing && (
              <span className="text-muted">
                {" "}
                · margin {formatINR(Math.round((pricePerSaleUnit - estimate.total) * 100) / 100)}
              </span>
            )}
          </p>
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <div>
          <h2 className="font-semibold">Internal specs</h2>
          <p className="text-xs text-muted">Only for you. Never printed on invoices.</p>
        </div>
        {specs.map((s, i) => (
          <div key={i} className="flex gap-2">
            <Input
              placeholder="e.g. Thickness"
              value={s.key}
              onChange={(e) => setSpecs((p) => p.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))}
            />
            <Input
              placeholder="e.g. 1.5 mm"
              value={s.value}
              onChange={(e) => setSpecs((p) => p.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
            />
            <button
              type="button"
              aria-label="Remove"
              onClick={() => setSpecs((p) => p.filter((_, j) => j !== i))}
              className="rounded p-1 text-muted hover:bg-surface-2"
            >
              ✕
            </button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setSpecs((p) => [...p, { key: "", value: "" }])}
        >
          + Add spec
        </Button>
      </Card>

      {!product && !sizesMode && (
        <Card className="space-y-4 p-4">
          <div>
            <h2 className="font-semibold">Ready stock</h2>
            <p className="text-xs text-muted">Finished {unitShort(saleUnit)} you have now. Leave blank if none.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={`Quantity (${unitShort(saleUnit)})`}>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={openingQty}
                onChange={(e) => setOpeningQty(e.target.value)}
              />
            </Field>
            {openingQty !== "" && (
              <Field label="Counted on">
                <Input
                  type="date"
                  max={todayIST()}
                  value={openingDate}
                  onChange={(e) => setOpeningDate(e.target.value)}
                />
              </Field>
            )}
          </div>
        </Card>
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
