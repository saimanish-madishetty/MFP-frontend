import type { MaterialType, Unit } from "./stock";

export type ProductMaterialLine = {
  id: number;
  materialId: number;
  qtyPerUnit: string | null;
  material: { id: number; name: string; type: MaterialType; unit: Unit; lastCostPerUnit: string | null; active: boolean };
};

export type Product = {
  id: number;
  internalName: string;
  publicName: string;
  code: string | null;
  packSize: string | null;
  packUnit: Unit | null;
  saleUnit: Unit;
  price: string;
  mrp: string | null;
  hsnCode: string | null;
  gstRate: string | null;
  specs: { key: string; value: string }[] | null;
  currentQty: string;
  active: boolean;
  materials: ProductMaterialLine[];
  cost: { costPerUnit: string | null; incomplete: boolean; margin: string | null };
};

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
