import { formatINR, todayIST } from "@/lib/format";
import { packFor, perUnit, unitFactor, type Product } from "@/lib/products";
import { formatQty, type Unit } from "@/lib/stock";

export type RecipeRow = { materialId: number; qty: string; perPiece: boolean };

/**
 * Everything that can differ between sizes of a product, as typed in the form: packing, prices,
 * materials per pack and ready stock. A single product has one; a product with sizes one per size.
 */
export type SizeDraft = {
  saleUnit: Unit;
  hasPieces: boolean;
  pieces: string;
  packSize: string;
  packUnit: Unit;
  /** Per unit sold (pack/bag); may be blank when `piecePrice` is given */
  price: string;
  /** Per piece or per kg/L; may be blank (worked out from `price`) */
  piecePrice: string;
  mrp: string;
  recipe: RecipeRow[];
  openingQty: string;
  openingDate: string;
};

/** A blank draft, or one copied from an existing product (Duplicate / Add size / Edit). */
export function draftFrom(src?: Product): SizeDraft {
  return {
    saleUnit: src?.saleUnit ?? "PACK",
    hasPieces: src ? (src.piecesPerUnit ?? 0) > 1 : true,
    pieces: src?.piecesPerUnit ? String(src.piecesPerUnit) : "",
    packSize: src?.packSize ? String(Number(src.packSize)) : "",
    packUnit: src?.packUnit ?? "G",
    price: src?.price ?? "",
    piecePrice: src?.piecePrice ?? "",
    mrp: src?.mrp ?? "",
    recipe:
      src?.materials.map((m) => ({ materialId: m.materialId, qty: m.qtyPerUnit ?? "", perPiece: m.perPiece })) ?? [],
    openingQty: "",
    openingDate: todayIST(),
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Packing and prices worked out from a draft, the way the backend will save them. */
export function draftPacking(d: SizeDraft) {
  const piecesPerUnit =
    d.hasPieces && d.saleUnit !== "PCS" && Number(d.pieces) > 1 ? Math.round(Number(d.pieces)) : null;
  const size = d.packSize === "" ? null : Number(d.packSize);
  const pack = packFor({ saleUnit: d.saleUnit, piecesPerUnit, packSize: size, packUnit: size ? d.packUnit : null });
  const twoUnits = pack.units.length > 1;
  const per = unitFactor({ saleUnit: d.saleUnit, pack }, d.saleUnit); // e.g. 10 pieces per pack, 25 kg per bag
  // A blank price is worked out from the other one, like the backend does.
  const pricePerSaleUnit =
    d.price !== "" ? Number(d.price) : twoUnits && d.piecePrice !== "" ? round2(Number(d.piecePrice) * per) : null;
  const derivedPiecePrice = d.price !== "" ? round2(Number(d.price) / per) : null;
  return { piecesPerUnit, size, pack, twoUnits, per, pricePerSaleUnit, derivedPiecePrice };
}

/** The packing, price and materials fields of a product request. */
export function draftBody(d: SizeDraft, withOpening: boolean) {
  const { piecesPerUnit, size, twoUnits } = draftPacking(d);
  return {
    saleUnit: d.saleUnit,
    piecesPerUnit,
    packSize: size,
    packUnit: size ? d.packUnit : null,
    price: d.price === "" ? null : Number(d.price),
    piecePrice: twoUnits && d.piecePrice !== "" ? Number(d.piecePrice) : null,
    mrp: d.mrp === "" ? null : Number(d.mrp),
    materials: d.recipe.map((r) => ({
      materialId: r.materialId,
      qtyPerUnit: r.qty === "" ? null : Number(r.qty),
      perPiece: piecesPerUnit !== null && r.perPiece,
    })),
    ...(withOpening && {
      openingQty: d.openingQty === "" ? undefined : Number(d.openingQty),
      openingDate: d.openingDate,
    }),
  };
}

/** What still has to be filled in before the draft can be saved. */
export function draftMissing(d: SizeDraft): string[] {
  const missing: string[] = [];
  if (d.hasPieces && d.saleUnit !== "PCS" && !(Number(d.pieces) > 1)) missing.push("pieces per pack");
  const { pricePerSaleUnit } = draftPacking(d);
  if (pricePerSaleUnit === null) missing.push("price");
  return missing;
}

/** "10 × 500 g pack · ₹300 per pack · 12 packs ready" */
export function draftSummary(d: SizeDraft): string {
  const { pack, pricePerSaleUnit } = draftPacking(d);
  return [
    pack.description,
    pricePerSaleUnit !== null && `${formatINR(pricePerSaleUnit)} ${perUnit(d.saleUnit)}`,
    Number(d.openingQty) > 0 && `${formatQty(Number(d.openingQty), d.saleUnit)} ready`,
  ]
    .filter(Boolean)
    .join(" · ");
}
