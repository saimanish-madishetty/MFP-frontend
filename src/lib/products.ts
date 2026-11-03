import { formatQty, unitShort, type MaterialType, type Unit } from "./stock";

/**
 * Packaging worked out by the backend (src/products/packaging.ts). Stock is kept in `stockUnit`:
 * pieces for "10 × 500 g" packs, kg for a "25 kg bag", otherwise the sale unit itself.
 * `units` are what the product can be sold/counted in, with stock units per 1 of each and the
 * selling price for that unit (`priceSet` false when worked out from the other unit's price).
 */
export type Pack = {
  stockUnit: Unit;
  description: string;
  /** Unit a new invoice line starts in */
  defaultUnit: Unit;
  units: { unit: Unit; factor: string; price?: string | null; priceSet?: boolean }[];
};

export type ProductMaterialLine = {
  id: number;
  materialId: number;
  qtyPerUnit: string | null;
  perPiece: boolean;
  material: { id: number; name: string; type: MaterialType; unit: Unit; lastCostPerUnit: string | null; active: boolean };
};

export type Product = {
  id: number;
  internalName: string;
  publicName: string;
  code: string | null;
  saleUnit: Unit;
  piecesPerUnit: number | null;
  packSize: string | null;
  packUnit: Unit | null;
  /** Per unit sold (pack, bag); null = worked out from piecePrice */
  price: string | null;
  /** Per piece or per kg/L; null = worked out from price */
  piecePrice: string | null;
  mrp: string | null;
  hsnCode: string | null;
  gstRate: string | null;
  specs: { key: string; value: string }[] | null;
  /** In `pack.stockUnit` */
  currentQty: string;
  active: boolean;
  materials: ProductMaterialLine[];
  pack: Pack;
  cost: { costPerUnit: string | null; incomplete: boolean; margin: string | null };
};

const BASE: Partial<Record<Unit, { base: Unit; per: number }>> = {
  G: { base: "KG", per: 1000 },
  KG: { base: "KG", per: 1 },
  ML: { base: "L", per: 1000 },
  L: { base: "L", per: 1 },
};

/**
 * Packaging for unsaved form values, so the product form can preview it while typing.
 * Mirrors the backend's src/products/packaging.ts, which is what's actually saved.
 */
export function packFor(f: {
  saleUnit: Unit;
  piecesPerUnit: number | null;
  packSize: number | null;
  packUnit: Unit | null;
}): Pack {
  const pieces = (f.piecesPerUnit ?? 0) > 1 ? f.piecesPerUnit! : null;
  const base = f.packSize && f.packUnit ? BASE[f.packUnit] : undefined;
  const stockUnit: Unit = pieces ? "PCS" : base ? base.base : f.saleUnit;
  const saleFactor = pieces ?? (base ? f.packSize! / base.per : 1);
  const size = f.packSize && f.packUnit ? `${formatQty(f.packSize)} ${unitShort(f.packUnit)}` : "";
  const sale = unitSingular(f.saleUnit);
  const total = pieces && base ? ` (${formatQty((f.packSize! * pieces) / base.per)} ${unitShort(base.base)})` : "";
  const description = pieces
    ? size
      ? `${pieces} × ${size} ${sale}${total}`
      : `${pieces} pcs ${sale}`
    : size
      ? `${size} ${sale}`
      : sale;
  const units =
    stockUnit === f.saleUnit
      ? [{ unit: f.saleUnit, factor: "1" }]
      : [
          { unit: f.saleUnit, factor: String(saleFactor) },
          { unit: stockUnit, factor: "1" },
        ];
  return { stockUnit, description, defaultUnit: f.saleUnit, units };
}

type Packed = { saleUnit: Unit; pack: Pack };

/** Selling price for one `unit` (own or worked out), as a number; null if none. */
export function priceFor(p: Packed, unit: Unit): number | null {
  const price = p.pack.units.find((u) => u.unit === unit)?.price;
  return price == null ? null : Number(price);
}

/** Stock units in one `unit` (e.g. 10 pieces per pack); 1 if the unit isn't listed. */
export function unitFactor(p: Packed, unit: Unit): number {
  return Number(p.pack.units.find((u) => u.unit === unit)?.factor ?? 1);
}

/** Converts a stock quantity into `unit`. */
export function fromStock(p: Packed, stockQty: string | number, unit: Unit = p.saleUnit): number {
  return Number(stockQty) / unitFactor(p, unit);
}

/** Stock for display: "4 packs + 3 pcs", "250 kg (10 bags)" or "12 boxes". */
export function formatStock(p: Packed, stockQty: string | number): string {
  const qty = Number(stockQty);
  const { stockUnit } = p.pack;
  if (stockUnit === p.saleUnit) return formatQty(qty, p.saleUnit);
  const per = unitFactor(p, p.saleUnit);
  if (stockUnit === "PCS") {
    const sign = qty < 0 ? "−" : "";
    const abs = Math.abs(qty);
    const whole = Math.floor(abs / per + 1e-9);
    const rest = Math.round((abs - whole * per) * 1000) / 1000;
    if (whole === 0) return `${sign}${formatQty(rest, "PCS")}`;
    return `${sign}${formatQty(whole, p.saleUnit)}${rest > 0 ? ` + ${formatQty(rest, "PCS")}` : ""}`;
  }
  return `${formatQty(qty, stockUnit)} (${formatQty(qty / per, p.saleUnit)})`;
}

const SINGULAR: Partial<Record<Unit, string>> = {
  PCS: "piece",
  PACK: "pack",
  BOX: "box",
  CARTON: "carton",
  BAG: "bag",
  ROLL: "roll",
};

/** "pack", "piece", "kg" */
export const unitSingular = (u: Unit) => SINGULAR[u] ?? unitShort(u);

/** "per pack", "per kg" */
export const perUnit = (u: Unit) => `per ${unitSingular(u)}`;

export type ProductMovementType = "OPENING" | "PRODUCED" | "SOLD" | "SALE_CANCELLED" | "ADJUSTMENT";

export type ProductDetail = Product & {
  movements: {
    id: number;
    date: string;
    type: ProductMovementType;
    quantity: string;
    note: string | null;
    balanceAfter: string;
    sale: { id: number; invoiceNumber: string } | null;
  }[];
};

export const PRODUCT_MOVEMENT_LABEL: Record<ProductMovementType, string> = {
  OPENING: "Opening stock",
  PRODUCED: "Made",
  SOLD: "Sold",
  SALE_CANCELLED: "Sale cancelled (returned)",
  ADJUSTMENT: "Adjustment",
};

export const GST_RATES = ["0", "5", "12", "18", "28"];
