import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

/** "2026-11-20" + "16:30" in a salon timezone → Date (UTC instant). */
export function zonedToDate(date: string, hhmm: string, tz: string): Date {
  return fromZonedTime(`${date}T${hhmm}:00`, tz);
}

/** Weekday (0 = Sunday) of a calendar date string, independent of server timezone. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function todayIn(tz: string, now = new Date()): string {
  return formatInTimeZone(now, tz, "yyyy-MM-dd");
}

export function fmtTime(d: Date | string, tz: string): string {
  return formatInTimeZone(new Date(d), tz, "HH:mm");
}

export function fmtDate(d: Date | string, tz: string): string {
  return formatInTimeZone(new Date(d), tz, "yyyy-MM-dd");
}

export function fmtHuman(d: Date | string, tz: string): string {
  return formatInTimeZone(new Date(d), tz, "EEE d MMM, h:mm a");
}

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
};
export const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export const isDate = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
export const isTime = (s: unknown): s is string => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/** Normalise a phone number to digits, adding the default country code for 10-digit local numbers. */
export function normalizePhone(raw: string | null | undefined, defaultCountryCode = "91"): string {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 10) return defaultCountryCode + d;
  if (d.length === 11 && d.startsWith("0")) return defaultCountryCode + d.slice(1);
  return d;
}

export function countryCodeFor(currency: string): string {
  return ({ INR: "91", USD: "1", CAD: "1", GBP: "44", AED: "971", AUD: "61", SGD: "65" } as Record<string, string>)[currency] ?? "91";
}
