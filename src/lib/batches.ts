import type { MaterialType, Unit, WastageLine } from "./stock";

export type BatchStatus = "OPEN" | "FINISHED" | "CANCELLED";

/** How a kind of product is made: its stages in order. Products pick the plan they follow. */
export type BatchPlan = {
  id: number;
  name: string;
  stages: string[];
  active: boolean;
  productIds: number[];
  openBatches: number;
  /** Materials of the plan's latest batch: a new batch starts with the same list */
  lastMaterialIds: number[];
};

export type BatchListItem = {
  id: number;
  number: string;
  status: BatchStatus;
  plan: { id: number; name: string };
  stages: string[];
  /** Index into `stages` of the stage reached */
  stage: number;
  /** The sizes (products) to be made */
  productIds: number[];
  startDate: string;
  endDate: string | null;
  /** When the current stage was reached */
  stageDate: string;
  materialsLost: boolean | null;
  /** Raw materials put in at the start */
  materials: { materialId: number; name: string; unit: Unit; quantity: string }[];
  products: { productId: number; stockQty: string }[];
};

export type BatchDetail = {
  id: number;
  number: string;
  status: BatchStatus;
  plan: { id: number; name: string };
  /** The sizes (products) to be made; packing starts with these */
  productIds: number[];
  stage: number;
  stages: { name: string; date: string | null }[];
  startDate: string;
  endDate: string | null;
  materialsLost: boolean | null;
  notes: string | null;
  /** Raw materials put in at the start (`packingId` null) and supplies used for each packing */
  materials: { materialId: number; name: string; type: MaterialType; unit: Unit; quantity: string; packingId: number | null }[];
  /** Made in all: `quantity` in sale units, `stockQty` in stock units */
  products: { productId: number; quantity: string; stockQty: string }[];
  /** Packs made on each day (a batch can be packed in parts), with the supplies used */
  packings: {
    id: number;
    date: string;
    products: { productId: number; stockQty: string }[];
    supplies: { materialId: number; name: string; unit: Unit; quantity: string }[];
  }[];
  wastage: (WastageLine & { material: { type: MaterialType } })[];
  /** ₹ at the materials' latest prices */
  cost: { materials: string; incomplete: boolean; waste: string };
};

export const STATUS_LABEL: Record<BatchStatus, string> = {
  OPEN: "In process",
  FINISHED: "Finished",
  CANCELLED: "Cancelled",
};

/** Whole days from `from` to `to` ("YYYY-MM-DD"). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** "today", "yesterday", "3 days ago" */
export function ago(date: string, today: string): string {
  const n = daysBetween(date, today);
  return n <= 0 ? "today" : n === 1 ? "yesterday" : `${n} days ago`;
}
