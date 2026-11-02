import type { PaymentMode } from "./workers";

export type BuyerSummary = {
  totalSales: string;
  totalPaid: string;
  balance: string;
  overdueAmount: string;
  overdueCount: number;
};

export type Buyer = {
  id: number;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  altPhone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstin: string | null;
  creditDays: number | null;
  openingBalance: string;
  notes: string | null;
  active: boolean;
  summary: BuyerSummary;
};

export type SalePaymentStatus = "UNPAID" | "PARTIAL" | "PAID";

export type TimelineItem =
  | {
      kind: "SALE";
      id: number;
      date: string;
      invoiceNumber: string;
      amount: string;
      amountPaid: string;
      paymentStatus: SalePaymentStatus;
      dueDate: string;
      overdue: boolean;
      cancelled: boolean;
    }
  | {
      kind: "PAYMENT";
      id: number;
      date: string;
      amount: string;
      mode: PaymentMode;
      reference: string | null;
      note: string | null;
      allocations: { saleId: number; invoiceNumber: string; amount: string }[];
    };

export type BuyerDetail = Buyer & { effectiveCreditDays: number; timeline: TimelineItem[] };

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

/** Digits only, with India's 91 prefix for 10-digit numbers (for wa.me / tel: links). */
export function phoneDigits(phone: string | null | undefined): string | null {
  const d = phone?.replace(/\D/g, "");
  if (!d) return null;
  return d.length === 10 ? `91${d}` : d;
}

export function whatsappLink(phone: string | null | undefined, text?: string): string | null {
  const d = phoneDigits(phone);
  if (!d) return null;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
