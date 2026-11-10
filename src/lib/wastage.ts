import { formatINR } from "./format";
import { formatQty, type MaterialType, type Unit } from "./stock";

/** GET /stock/production/wastage/lines: materials used vs. the recipe, per product and day. */
export type WastageData = {
  materials: { id: number; name: string; type: MaterialType; unit: Unit; lastCostPerUnit: string | null }[];
  /** `made` in sale units, `madeStock` in stock units */
  made: { date: string; productId: number; made: string; madeStock: string }[];
  lines: WastageDataLine[];
};

export type WastageDataLine = {
  date: string;
  productId: number;
  materialId: number;
  used: string;
  /** null: not in the product's recipe, so no wastage can be worked out */
  expected: string | null;
  /** A supply: the day's use shared out between the products made, by recipe */
  shared?: boolean;
  /** From a finished batch (its number): the batch's use shared out between the products made */
  batch?: string;
};

type Material = WastageData["materials"][number];

/** kg and g add up as kg, L and mL as L; other units only with themselves. */
const BASE: Partial<Record<Unit, { unit: Unit; factor: number }>> = {
  KG: { unit: "KG", factor: 1 },
  G: { unit: "KG", factor: 0.001 },
  L: { unit: "L", factor: 1 },
  ML: { unit: "L", factor: 0.001 },
};
const baseOf = (u: Unit) => BASE[u] ?? { unit: u, factor: 1 };

/**
 * How the chosen materials add up: in their unit when they all share one (Maida + Atta: kg),
 * otherwise in ₹ at each material's latest price (Maida + PP covers). Nothing chosen: all, in ₹.
 */
export type Measure = { kind: "qty"; unit: Unit } | { kind: "value" };

export function measureFor(chosen: Material[]): Measure {
  if (chosen.length === 0) return { kind: "value" };
  const units = new Set(chosen.map((m) => baseOf(m.unit).unit));
  return units.size === 1 ? { kind: "qty", unit: [...units][0] } : { kind: "value" };
}

/** A sum of wastage: `amount` in the measure; `missing` = some lines had no price (₹ only). */
export type Total = { amount: number; counted: number; missing: boolean };

export function addUp(lines: WastageDataLine[], byId: Map<number, Material>, measure: Measure): Total {
  let amount = 0;
  let counted = 0;
  let missing = false;
  for (const l of lines) {
    if (l.expected === null) continue;
    const m = byId.get(l.materialId);
    if (!m) continue;
    const waste = Number(l.used) - Number(l.expected);
    if (measure.kind === "qty") amount += waste * baseOf(m.unit).factor;
    else if (m.lastCostPerUnit === null) {
      if (waste !== 0) missing = true;
      continue;
    } else amount += waste * Number(m.lastCostPerUnit);
    counted++;
  }
  return { amount: Math.round(amount * 1000) / 1000, counted, missing };
}

/** "+2.8 kg extra" / "1 kg saved" / "≈ ₹89.60 extra" / "as recipe" */
export function formatTotal(t: Total, measure: Measure): string {
  if (t.amount === 0) return t.counted === 0 ? "—" : "as recipe";
  const a = Math.abs(t.amount);
  const word = t.amount > 0 ? "extra" : "saved";
  return measure.kind === "qty"
    ? `${formatQty(Math.round(a * 1000) / 1000, measure.unit)} ${word}`
    : `≈ ${formatINR(Math.round(a * 100) / 100)} ${word}`;
}

/** Short form for a calendar cell: "+2.8", "−50", "₹90", "₹1.2k". */
export function shortTotal(t: Total, measure: Measure): string {
  const a = Math.abs(t.amount);
  const sign = t.amount > 0 ? "+" : "−";
  if (measure.kind === "qty") {
    const n = a >= 1000 ? `${Math.round(a / 100) / 10}k` : String(Math.round(a * 10) / 10);
    return `${sign}${n}`; // the unit is shown above the calendar ("Showing kg")
  }
  return `${t.amount < 0 ? "−" : ""}₹${a >= 1000 ? `${Math.round(a / 100) / 10}k` : Math.round(a)}`;
}
