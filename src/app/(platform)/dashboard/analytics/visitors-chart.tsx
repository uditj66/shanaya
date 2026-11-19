"use client";
// Website visitors per day: one drawn series, so no legend (the card title names it); crosshair tooltip; sr-only table.
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/admin/ui/chart";
import { CHANNEL_COLORS } from "../overview-charts";

type Row = { label: string; visitors: number; views: number };

const config = {
  visitors: { label: "Visitors", color: CHANNEL_COLORS.web },
  views: { label: "Page views", color: "var(--chart-4)" },
} satisfies ChartConfig;

export function VisitorsChart({ data }: { data: Row[] }) {
  return (
    <figure>
      <ChartContainer config={config} className="aspect-auto h-56 w-full" aria-hidden="true">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <defs>
            <linearGradient id="visitors-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-visitors)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--color-visitors)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" minTickGap={24} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
          <ChartTooltip cursor={{ strokeDasharray: "3 3" }} content={<ChartTooltipContent indicator="line" />} />
          <Area
            type="monotone"
            dataKey="visitors"
            stroke="var(--color-visitors)"
            strokeWidth={2}
            fill="url(#visitors-fill)"
            activeDot={{ r: 4, stroke: "var(--background)", strokeWidth: 2 }}
            dot={false}
            animationDuration={700}
          />
          {/* Page views appear in the tooltip only: an invisible series keeps the chart to one line. */}
          <Area type="monotone" dataKey="views" stroke="var(--color-views)" strokeOpacity={0} fill="none" activeDot={false} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ChartContainer>
      <table className="sr-only">
        <caption>Website visitors per day</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>Visitors</th>
            <th>Page views</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td>{r.visitors}</td>
              <td>{r.views}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
