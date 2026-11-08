export type MaterialType = "RAW" | "SUPPLY";
export type Unit = "KG" | "G" | "L" | "ML" | "PCS" | "PACK" | "BOX" | "CARTON" | "BAG" | "ROLL" | "METER";
export type StockStatus = "NEGATIVE" | "LOW" | "OK";
export type MovementType = "OPENING" | "PURCHASE" | "USAGE" | "ADJUSTMENT";

export type Material = {
  id: number;
  name: string;
  type: MaterialType;
  unit: Unit;
  currentQty: string;
  lowStockLevel: string | null;
  lastCostPerUnit: string | null;
  notes: string | null;
  active: boolean;
  status: StockStatus;
};

export type MaterialListItem = Material & { lastUsedOn: string | null };

export type StockMovement = {
  id: number;
  date: string;
  type: MovementType;
  quantity: string;
  costPerUnit: string | null;
  supplier: string | null;
  note: string | null;
  balanceAfter: string;
};

export type MaterialDetail = Material & { movements: StockMovement[] };

export type ProductionDay = {
  date: string;
  entry: {
    id: number;
    notes: string | null;
    /** Materials used for no product in particular (e.g. supplies) */
    items: { materialId: number; quantity: string }[];
    /** Made, in the product's sale unit, with the raw materials used for it */
    products: {
      productId: number;
      quantity: string;
      /** The same in stock units (pieces, kg, …) */
      stockQty: string;
      materials: {
        materialId: number;
        quantity: string;
        expected: string | null;
        waste: string | null;
        wastePct: string | null;
      }[];
    }[];
  } | null;
};

/** One material's use vs. recipe; `waste` = used − expected (negative = less than the recipe). */
export type WastageLine = {
  material: { id: number; name: string; unit: Unit };
  used: string;
  expected: string | null;
  waste: string | null;
  wastePct: string | null;
  /** ₹ value of `waste` at the material's latest price; null when not in the recipe or no price */
  value: string | null;
};

export type ProductWastage = {
  /** `made` in sale units, `madeStock` in stock units; `wasteValue` in ₹ */
  days: { date: string; made: string | null; madeStock: string | null; wasteValue: string; materials: WastageLine[] }[];
  totals: WastageLine[];
};

export type StockOverview = {
  date: string;
  materials: number;
  lowStock: { id: number; name: string; unit: Unit; currentQty: string }[];
  negativeStock: { id: number; name: string; unit: Unit; currentQty: string }[];
  dayEndDoneToday: boolean;
  lastDayEndOn: string | null;
};

export const UNITS: { value: Unit; label: string; short: string }[] = [
  { value: "KG", label: "Kilogram (kg)", short: "kg" },
  { value: "G", label: "Gram (g)", short: "g" },
  { value: "L", label: "Litre (L)", short: "L" },
  { value: "ML", label: "Millilitre (ml)", short: "ml" },
  { value: "PCS", label: "Pieces (pcs)", short: "pcs" },
  { value: "PACK", label: "Packs", short: "packs" },
  { value: "BOX", label: "Boxes", short: "boxes" },
  { value: "CARTON", label: "Cartons", short: "cartons" },
  { value: "BAG", label: "Bags", short: "bags" },
  { value: "ROLL", label: "Rolls", short: "rolls" },
  { value: "METER", label: "Metres (m)", short: "m" },
];

export const unitShort = (u: Unit) => UNITS.find((x) => x.value === u)?.short ?? u.toLowerCase();

export const TYPE_LABEL: Record<MaterialType, string> = { RAW: "Raw material", SUPPLY: "Supply" };

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  OPENING: "Opening stock",
  PURCHASE: "Purchase",
  USAGE: "Used in production",
  ADJUSTMENT: "Adjustment",
};

const QTY = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 });

/** "1,250.5 kg" */
export function formatQty(qty: string | number, unit?: Unit): string {
  const text = QTY.format(Number(qty));
  return unit ? `${text} ${unitShort(unit)}` : text;
}
