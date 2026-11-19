"use client";
// Bookings made per day, by channel. Stacked columns with legend + tooltip, and a table view for screen readers.
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/admin/ui/chart";

// Theme chart colours (admin-theme.css), so they follow light/dark.
export const CHANNEL_COLORS = { phone: "var(--chart-1)", web: "var(--chart-2)", staff: "var(--chart-4)" } as const;
export const CHANNEL_LABELS = { phone: "Phone (Shanaya)", web: "Website", staff: "Front desk" } as const;
type Row = { date: string; label: string; phone: number; web: number; staff: number };
const KEYS = ["phone", "web", "staff"] as const;

const config = {
  phone: { label: CHANNEL_LABELS.phone, color: CHANNEL_COLORS.phone },
  web: { label: CHANNEL_LABELS.web, color: CHANNEL_COLORS.web },
  staff: { label: CHANNEL_LABELS.staff, color: CHANNEL_COLORS.staff },
} satisfies ChartConfig;

export function BookingsByChannel({ data }: { data: Row[] }) {
  return (
    <figure>
      <ChartContainer config={config} className="aspect-auto h-64 w-full" aria-hidden="true">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" minTickGap={18} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
          <ChartLegend content={<ChartLegendContent />} />
          {KEYS.map((k, i) => (
            <Bar key={k} dataKey={k} stackId="a" fill={`var(--color-${k})`} maxBarSize={24} radius={i === KEYS.length - 1 ? [4, 4, 0, 0] : 0} />
          ))}
        </BarChart>
      </ChartContainer>
      <figcaption className="sr-only">Bookings made per day over the last 14 days, by channel.</figcaption>
      <table className="sr-only">
        <thead>
          <tr>
            <th>Day</th>
            {KEYS.map((k) => (
              <th key={k}>{CHANNEL_LABELS[k]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.date}>
              <td>{r.label}</td>
              {KEYS.map((k) => (
                <td key={k}>{r[k]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
