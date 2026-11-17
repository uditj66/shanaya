// Opening-hours helpers for studio pages (pure; unit tested).
import { formatInTimeZone } from "date-fns-tz";

export type Hours = Record<string, [string, string][]>; // "0" = Sunday … "6" = Saturday; [] = closed
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Normalise the two stored shapes: [["10:00","21:00"]] and ["10:00 21:00"]. */
function ranges(day: unknown): [string, string][] {
  if (!Array.isArray(day)) return [];
  return day
    .map((r) => (Array.isArray(r) ? r : typeof r === "string" ? r.split(/[ -]+/) : []))
    .filter((r): r is [string, string] => r.length === 2 && !!r[0] && !!r[1]);
}

const label = (r: [string, string][]) => (r.length ? r.map(([a, b]) => `${a}–${b}`).join(", ") : "Closed");

/** Monday-first rows with consecutive identical days merged: [{ days: "Mon – Sat", hours: "10:00–21:00" }, …] */
export function hoursRows(hours: Hours) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const rows: { from: number; to: number; hours: string }[] = [];
  for (const d of order) {
    const h = label(ranges(hours[String(d)]));
    const last = rows[rows.length - 1];
    if (last && last.hours === h) last.to = d;
    else rows.push({ from: d, to: d, hours: h });
  }
  return rows.map((r) => ({ days: r.from === r.to ? DAYS[r.from] : `${SHORT[r.from]} – ${SHORT[r.to]}`, hours: r.hours }));
}

/** schema.org openingHoursSpecification for JSON-LD. */
export function openingHoursSpec(hours: Hours) {
  return [0, 1, 2, 3, 4, 5, 6].flatMap((d) =>
    ranges(hours[String(d)]).map(([opens, closes]) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: DAYS[d], opens, closes })),
  );
}

/** Whether the studio is open at `now` (in its own timezone), and the next change. */
export function openState(hours: Hours, tz: string, now: Date) {
  const day = Number(formatInTimeZone(now, tz, "i")) % 7; // ISO 1..7 (Mon..Sun) → 0 = Sunday
  const hhmm = formatInTimeZone(now, tz, "HH:mm");
  const today = ranges(hours[String(day)]);
  const current = today.find(([a, b]) => hhmm >= a && hhmm < b);
  if (current) return { open: true as const, text: `Open now · until ${current[1]}` };
  const later = today.find(([a]) => hhmm < a);
  if (later) return { open: false as const, text: `Closed · opens at ${later[0]}` };
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    const r = ranges(hours[String(d)]);
    if (r.length) return { open: false as const, text: `Closed · opens ${i === 1 ? "tomorrow" : DAYS[d]} at ${r[0][0]}` };
  }
  return { open: false as const, text: "Closed" };
}
