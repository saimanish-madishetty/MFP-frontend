import { WEEKDAYS, formatINR, ordinal } from "./format";

export type PayType = "DAILY" | "MONTHLY";
export type PayCycle = "WEEKLY" | "MONTHLY" | "MANUAL";
export type AttendanceStatus = "PRESENT" | "HALF_DAY" | "ABSENT" | "PAID_LEAVE";
export type PaymentMode = "CASH" | "UPI" | "BANK" | "CHEQUE";

export type Worker = {
  id: number;
  name: string;
  phone: string | null;
  role: string | null;
  joiningDate: string;
  payType: PayType;
  rate: string;
  workingDaysPerMonth: number | null;
  payCycle: PayCycle;
  payWeekday: number | null;
  payMonthDay: number | null;
  notes: string | null;
  permanent: boolean;
  active: boolean;
};

export type AttendanceChange = {
  id: number;
  date: string;
  oldStatus: AttendanceStatus | null;
  oldBonus: string;
  newStatus: AttendanceStatus | null;
  newBonus: string;
  difference: string;
};

export type PaySummary = {
  periodStart: string;
  upTo: string;
  lastSettledOn: string | null;
  counts: Record<AttendanceStatus, number>;
  daysWorked: number;
  earned: string;
  bonus: string;
  advances: string;
  broughtForward: string;
  payable: string;
  unmarkedDays: string[];
  pendingChanges: AttendanceChange[];
  nextPayDate: string | null;
  payDue: boolean;
};

export type Advance = { id: number; date: string; amount: string; mode: PaymentMode; note: string | null };

export type Settlement = {
  id: number;
  periodStart: string;
  periodEnd: string;
  daysWorked: string;
  earned: string;
  bonus: string;
  advances: string;
  broughtForward: string;
  payable: string;
  amountPaid: string;
  mode: PaymentMode;
  paidOn: string;
  note: string | null;
  reportedChanges: { id: number }[];
};

export type WorkerWithSummary = Worker & { summary: PaySummary };
export type WorkerDetail = WorkerWithSummary & { advances: Advance[]; settlements: Settlement[] };

export type AttendanceRow = {
  worker: { id: number; name: string; role: string | null; payType: PayType; permanent: boolean; active: boolean };
  status: AttendanceStatus | null;
  bonus: string;
  note: string | null;
  settled: boolean;
};

export type MonthAttendance = {
  month: string;
  joiningDate: string;
  settledUpTo: string | null;
  days: { date: string; status: AttendanceStatus; bonus: string; earned: string; note: string | null }[];
};

export const STATUSES: {
  value: AttendanceStatus;
  short: string;
  label: string;
  /** Selected button style */
  on: string;
  /** Calendar cell style */
  cell: string;
}[] = [
  { value: "PRESENT", short: "P", label: "Present", on: "bg-green-600 text-white border-green-600", cell: "bg-green-500/20 text-green-800 dark:text-green-300" },
  { value: "HALF_DAY", short: "½", label: "Half day", on: "bg-amber-500 text-white border-amber-500", cell: "bg-amber-500/20 text-amber-800 dark:text-amber-300" },
  { value: "ABSENT", short: "A", label: "Absent", on: "bg-red-600 text-white border-red-600", cell: "bg-red-500/20 text-red-800 dark:text-red-300" },
  { value: "PAID_LEAVE", short: "L", label: "Paid leave", on: "bg-blue-600 text-white border-blue-600", cell: "bg-blue-500/20 text-blue-800 dark:text-blue-300" },
];

export function statusLabel(status: AttendanceStatus | null): string {
  return STATUSES.find((s) => s.value === status)?.label ?? "Not marked";
}

export const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "BANK", label: "Bank transfer" },
  { value: "CHEQUE", label: "Cheque" },
];

export function rateLabel(w: Pick<Worker, "payType" | "rate" | "workingDaysPerMonth">): string {
  if (w.payType === "DAILY") return `${formatINR(w.rate)} / day`;
  return `${formatINR(w.rate)} / month · ${w.workingDaysPerMonth ?? 26} working days`;
}

export function payCycleLabel(w: Pick<Worker, "payCycle" | "payWeekday" | "payMonthDay">): string {
  if (w.payCycle === "WEEKLY" && w.payWeekday !== null) return `Every ${WEEKDAYS[w.payWeekday]}`;
  if (w.payCycle === "MONTHLY" && w.payMonthDay !== null) return `${ordinal(w.payMonthDay)} of every month`;
  return "Whenever I settle";
}
