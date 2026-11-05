import type { Buyer, SalePaymentStatus } from "./buyers";
import type { Unit } from "./stock";
import type { PaymentMode } from "./workers";

export type CompanyProfile = {
  businessName: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  fssaiNumber: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  bankName: string | null;
  upiId: string | null;
  invoicePrefix: string;
  termsText: string | null;
  signatoryName: string | null;
  defaultCreditDays: number;
  pricesIncludeGst: boolean;
};

export type SaleListItem = {
  id: number;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  buyerId: number;
  buyerName: string;
  grandTotal: string;
  amountPaid: string;
  paymentStatus: SalePaymentStatus;
  cancelledAt: string | null;
  overdue: boolean;
  _count: { lines: number };
};

export type SaleLine = {
  id: number;
  lineNo: number;
  productId: number;
  publicName: string;
  /** Packing at time of sale, e.g. "10 × 500 g pack (5 kg)" */
  description: string | null;
  hsnCode: string | null;
  /** In `unit` (pack, piece, bag, kg, …) */
  quantity: string;
  unit: Unit;
  /** Same quantity in the product's stock unit */
  stockQty: string;
  rate: string;
  discount: string;
  taxableValue: string;
  gstRate: string;
  cgst: string;
  sgst: string;
  igst: string;
  lineTotal: string;
  product: { internalName: string };
};

export type SaleDetail = {
  id: number;
  invoiceNumber: string;
  financialYear: string;
  type: "TAX_INVOICE" | "BILL";
  date: string;
  dueDate: string;
  buyerId: number;
  buyerName: string;
  buyerAddress: string | null;
  buyerPhone: string | null;
  buyerGstin: string | null;
  placeOfSupply: string | null;
  isInterState: boolean;
  subtotal: string;
  discountTotal: string;
  taxableTotal: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  roundOff: string;
  grandTotal: string;
  amountPaid: string;
  paymentStatus: SalePaymentStatus;
  notes: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  overdue: boolean;
  buyerBalance: string;
  previousBalance: string;
  lines: SaleLine[];
  allocations: {
    id: number;
    amount: string;
    payment: { id: number; date: string; mode: PaymentMode; reference: string | null; amount: string };
  }[];
  buyer: Buyer;
};

export type SaleStatusFilter = "ALL" | "UNPAID" | "OVERDUE" | "PAID" | "CANCELLED";

/** GET /sales/search: one page of invoices; count / total / due are over every match. */
export type SaleSearch = {
  items: SaleListItem[];
  count: number;
  total: string;
  due: string;
  hasMore: boolean;
};

export type SaleSort = "new" | "old" | "high" | "low";

export function saleStatus(s: {
  cancelledAt?: string | null;
  cancelled?: boolean;
  overdue: boolean;
  paymentStatus: SalePaymentStatus;
}): { label: string; tone: "red" | "amber" | "green" | "neutral" | "blue" } {
  if (s.cancelledAt || s.cancelled) return { label: "Cancelled", tone: "neutral" };
  if (s.overdue) return { label: "Overdue", tone: "red" };
  if (s.paymentStatus === "PAID") return { label: "Paid", tone: "green" };
  if (s.paymentStatus === "PARTIAL") return { label: "Part paid", tone: "blue" };
  return { label: "Unpaid", tone: "amber" };
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number): string {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}

function belowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", rest ? belowHundred(rest) : ""].filter(Boolean).join(" ");
}

/** Indian numbering: 112345.5 → "Rupees One Lakh Twelve Thousand Three Hundred Forty Five and Fifty Paise Only" */
export function amountInWords(amount: number): string {
  const rupees = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - rupees) * 100);
  const parts: string[] = [];
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const rest = rupees % 1000;
  if (crore) parts.push(`${crore >= 100 ? belowThousand(crore) : belowHundred(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (rest) parts.push(belowThousand(rest));
  const words = parts.join(" ") || "Zero";
  return `Rupees ${words}${paise ? ` and ${belowHundred(paise)} Paise` : ""} Only`;
}

/**
 * Live preview of invoice totals while typing (the server recalculates on save).
 * Same rules as the backend: discount before tax; tax added on top or taken out of
 * GST-inclusive prices; CGST+SGST in the same state, IGST otherwise; total rounded to the rupee.
 */
export function previewInvoice(
  lines: { quantity: number; rate: number; discount: number; gstRate: number }[],
  opts: { taxed: boolean; pricesIncludeGst: boolean; interState: boolean },
) {
  const paise = (n: number) => Math.round(n * 100 + Number.EPSILON * Math.sign(n));
  const rows = lines.map((l) => {
    const net = paise(l.quantity * l.rate) - paise(l.discount);
    const rate = opts.taxed ? l.gstRate : 0;
    const taxable = opts.pricesIncludeGst && rate > 0 ? Math.round(net / (1 + rate / 100)) : net;
    const tax = opts.pricesIncludeGst && rate > 0 ? net - taxable : Math.round((taxable * rate) / 100);
    return { taxable, tax, total: taxable + tax };
  });
  const sum = (pick: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + pick(r), 0);
  const exact = sum((r) => r.total);
  const grand = Math.round(exact / 100) * 100;
  const tax = sum((r) => r.tax);
  return {
    lineTotals: rows.map((r) => r.total / 100),
    taxable: sum((r) => r.taxable) / 100,
    cgst: opts.interState ? 0 : Math.round(tax / 2) / 100,
    sgst: opts.interState ? 0 : (tax - Math.round(tax / 2)) / 100,
    igst: opts.interState ? tax / 100 : 0,
    roundOff: (grand - exact) / 100,
    grandTotal: grand / 100,
  };
}
