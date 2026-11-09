// Business dates are "YYYY-MM-DD" strings in IST throughout the app.

const IST_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function todayIST(): string {
  return IST_DATE.format(new Date());
}

/** "2026-10-24T00:00:00.000Z" or "2026-10-24" → "2026-10-24" */
export function ymd(value: string): string {
  return value.slice(0, 10);
}

function toUTC(date: string): Date {
  return new Date(`${ymd(date)}T00:00:00Z`);
}

export function addDays(date: string, days: number): string {
  const d = toUTC(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Every date in the app is shown as DD/MM/YY: "Sat, 24/10/26", or "24/10/26" with `weekday: false`.
 * The year is always shown (`year` is kept so older calls still compile).
 */
export function formatDay(date: string, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const [y, m, d] = ymd(date).split("-");
  const day = `${d}/${m}/${y.slice(2)}`;
  return opts.weekday === false ? day : `${SHORT_WEEKDAYS[toUTC(date).getUTCDay()]}, ${day}`;
}

/** "October 2026" for "2026-10" */
export function formatMonth(month: string): string {
  return toUTC(`${month}-01`).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

export function addMonths(month: string, delta: number): string {
  const d = toUTC(`${month}-01`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
}

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const INR_WHOLE = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** ₹1,23,456 or ₹1,23,456.50 */
export function formatINR(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isInteger(n) ? INR_WHOLE.format(n) : INR.format(n);
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
