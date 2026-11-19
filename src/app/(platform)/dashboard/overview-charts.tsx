"use client";
// Bookings made per day, by channel. Stacked columns, one axis, legend + tooltip, and a table view for screen readers.
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Validated categorical palette (dataviz validator: lightness, chroma, CVD ≥ 8, normal-vision, 3:1 contrast all pass).
export const CHANNEL_COLORS = { phone: "#a96a24", web: "#1a86ab", staff: "#b0496c" } as const;
export const CHANNEL_LABELS = { phone: "Phone (Shanaya)", web: "Website", staff: "Front desk" } as const;
type Row = { date: string; label: string; phone: number; web: number; staff: number };
const KEYS = ["phone", "web", "staff"] as const;

function TooltipBox({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + p.value, 0);
  return (
    <div className="rounded-xl border border-line bg-ivory px-3 py-2 text-xs shadow-lift">
      <p className="font-medium text-charcoal">{label} · {total} booking{total === 1 ? "" : "s"}</p>
      <ul className="mt-1 grid gap-0.5">
        {[...payload].reverse().map((p) => (
          <li key={p.dataKey} className="flex items-center gap-2 text-stone">
            <span className="size-2 rounded-sm" style={{ background: CHANNEL_COLORS[p.dataKey as keyof typeof CHANNEL_COLORS] }} />
            {CHANNEL_LABELS[p.dataKey as keyof typeof CHANNEL_LABELS]}: <span className="tabular-nums text-charcoal">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BookingsByChannel({ data }: { data: Row[] }) {
  const totals = Object.fromEntries(KEYS.map((k) => [k, data.reduce((s, r) => s + r[k], 0)])) as Record<(typeof KEYS)[number], number>;
  return (
    <figure>
      <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-stone" aria-label="Legend">
        {KEYS.map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 rounded-sm" style={{ background: CHANNEL_COLORS[k] }} />
            {CHANNEL_LABELS[k]} <span className="tabular-nums text-charcoal">{totals[k]}</span>
          </li>
        ))}
      </ul>
      <div className="h-56" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="#ece4d8" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#e6dccd" }} tick={{ fill: "#655a53", fontSize: 11 }} interval="preserveStartEnd" minTickGap={18} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#655a53", fontSize: 11 }} width={40} />
            <Tooltip content={<TooltipBox />} cursor={{ fill: "rgb(43 37 35 / 0.04)" }} />
            {KEYS.map((k, i) => (
              <Bar
                key={k}
                dataKey={k}
                stackId="a"
                fill={CHANNEL_COLORS[k]}
                maxBarSize={24}
                stroke="#ffffff"
                strokeWidth={2}
                radius={i === KEYS.length - 1 ? [4, 4, 0, 0] : 0}
                isAnimationActive
                animationDuration={700}
                animationEasing="ease-out"
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">Bookings made per day over the last 14 days, by channel.</figcaption>
      <table className="sr-only">
        <thead>
          <tr><th>Day</th>{KEYS.map((k) => <th key={k}>{CHANNEL_LABELS[k]}</th>)}</tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.date}><td>{r.label}</td>{KEYS.map((k) => <td key={k}>{r[k]}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
