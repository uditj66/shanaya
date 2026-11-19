"use client";
// Website visitors per day: one series, so no legend box (the card title names it); crosshair tooltip; sr-only table.
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHANNEL_COLORS } from "../overview-charts";

type Row = { label: string; visitors: number; views: number };
const C = CHANNEL_COLORS.web;

function TooltipBox({ active, payload, label }: { active?: boolean; payload?: { payload: Row }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-xl border border-line bg-ivory px-3 py-2 text-xs shadow-lift">
      <p className="font-medium text-charcoal">{label}</p>
      <p className="mt-0.5 text-stone">Visitors <span className="tabular-nums text-charcoal">{r.visitors}</span> · Page views <span className="tabular-nums text-charcoal">{r.views}</span></p>
    </div>
  );
}

export function VisitorsChart({ data }: { data: Row[] }) {
  return (
    <figure>
      <div className="h-56" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
            <defs>
              <linearGradient id="visitors-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C} stopOpacity={0.18} />
                <stop offset="100%" stopColor={C} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#ece4d8" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#e6dccd" }} tick={{ fill: "#655a53", fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#655a53", fontSize: 11 }} width={40} />
            <Tooltip content={<TooltipBox />} cursor={{ stroke: "#655a53", strokeDasharray: "3 3" }} />
            <Area type="monotone" dataKey="visitors" stroke={C} strokeWidth={2} fill="url(#visitors-fill)" activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} dot={false} animationDuration={700} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Website visitors per day</caption>
        <thead><tr><th>Day</th><th>Visitors</th><th>Page views</th></tr></thead>
        <tbody>{data.map((r) => <tr key={r.label}><td>{r.label}</td><td>{r.visitors}</td><td>{r.views}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
