// Availability engine.
// A slot is offered only if: the salon is open, a therapist who performs the service is working,
// the full treatment fits inside their shift, nothing overlaps (bookings incl. cleanup buffer,
// leave, breaks, salon closures), and it respects minimum notice.
import { toMinutes, toHHMM, zonedToDate, weekdayOf } from "./time";

export type Interval = { start: number; end: number }; // epoch ms, end exclusive

export type StaffDay = {
  id: string;
  name: string;
  shifts: { start: string; end: string }[]; // "HH:MM" local
  busy: Interval[];
  bookingsToday: number;
};

export type SlotInput = {
  date: string; // YYYY-MM-DD (salon local)
  tz: string;
  businessHours: Record<string, [string, string][]>;
  staff: StaffDay[];
  salonClosures: Interval[];
  durationMin: number;
  bufferMin: number;
  intervalMin: number;
  earliest: number; // epoch ms (now + minimum notice)
};

export type Slot = { time: string; startsAt: string; staffIds: string[] };

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

export function computeSlots(input: SlotInput): Slot[] {
  const weekday = String(weekdayOf(input.date));
  const open = input.businessHours[weekday] ?? [];
  if (!open.length) return [];

  const bySlot = new Map<number, string[]>();

  for (const st of input.staff) {
    for (const shift of st.shifts) {
      for (const [o, c] of open) {
        // working window = staff shift ∩ business hours
        const from = Math.max(toMinutes(shift.start), toMinutes(o));
        const to = Math.min(toMinutes(shift.end), toMinutes(c));
        // align to the interval grid (e.g. :00 :15 :30 :45)
        let t = Math.ceil(from / input.intervalMin) * input.intervalMin;
        for (; t + input.durationMin <= to; t += input.intervalMin) {
          const start = zonedToDate(input.date, toHHMM(t), input.tz).getTime();
          if (start < input.earliest) continue;
          const block: Interval = { start, end: start + (input.durationMin + input.bufferMin) * 60_000 };
          if (st.busy.some((b) => overlaps(b, block))) continue;
          if (input.salonClosures.some((b) => overlaps(b, block))) continue;
          const ids = bySlot.get(t) ?? [];
          if (!ids.includes(st.id)) ids.push(st.id);
          bySlot.set(t, ids);
        }
      }
    }
  }

  // Prefer the least-busy therapist first so work is spread evenly.
  const load = new Map(input.staff.map((s) => [s.id, s.bookingsToday]));
  return [...bySlot.entries()]
    .sort(([a], [b]) => a - b)
    .map(([t, ids]) => ({
      time: toHHMM(t),
      startsAt: zonedToDate(input.date, toHHMM(t), input.tz).toISOString(),
      staffIds: ids.sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0)),
    }));
}

/** Pick a short, speakable list: closest to the preferred time, or spread across the day. */
export function pickSlots(slots: Slot[], preferred?: string, max = 5): Slot[] {
  if (!slots.length) return [];
  if (preferred && /^\d{1,2}:\d{2}$/.test(preferred)) {
    const p = toMinutes(preferred);
    return [...slots]
      .sort((a, b) => Math.abs(toMinutes(a.time) - p) - Math.abs(toMinutes(b.time) - p))
      .slice(0, max)
      .sort((a, b) => a.time.localeCompare(b.time));
  }
  if (slots.length <= max) return slots;
  const step = (slots.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => slots[Math.round(i * step)]);
}
