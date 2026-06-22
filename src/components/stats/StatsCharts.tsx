"use client";

import { Bar, BarChart, Cell, LabelList, Pie, PieChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export const CHART_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  slices: DonutSlice[];
  centerPrimary?: string;
  centerSecondary?: string;
  ariaLabel: string;
}

export function DonutChart({
  slices,
  centerPrimary,
  centerSecondary,
  ariaLabel,
}: DonutChartProps) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const config: ChartConfig = Object.fromEntries(
    slices.map((s) => [s.key, { label: s.label, color: s.color }])
  );

  return (
    <div role="img" aria-label={ariaLabel} className="space-y-3">
      <div className="relative mx-auto h-[180px] w-[180px]">
        <ChartContainer config={config} className="aspect-square h-[180px] w-[180px]">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="key"
              innerRadius="62%"
              outerRadius="92%"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {slices.map((s) => (
                <Cell key={s.key} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        {(centerPrimary || centerSecondary) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {centerPrimary && (
              <span className="text-xl font-semibold text-[var(--app-text)]">
                {centerPrimary}
              </span>
            )}
            {centerSecondary && (
              <span className="text-xs text-[var(--app-text-muted)]">
                {centerSecondary}
              </span>
            )}
          </div>
        )}
      </div>
      <ul className="space-y-1.5">
        {slices.map((s) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          return (
            <li key={s.key} className="flex items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: s.color }}
                aria-hidden="true"
              />
              <span className="text-[var(--app-text)]">{s.label}</span>
              <span className="ml-auto tabular-nums text-[var(--app-text-muted)]">
                {s.value}
              </span>
              <span className="w-12 text-right tabular-nums text-[var(--app-text-muted)]">
                {pct.toFixed(0)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  displayValue: string;
  color: string;
}

export interface HorizontalBarChartProps {
  bars: BarDatum[];
  ariaLabel: string;
}

export function HorizontalBarChart({ bars, ariaLabel }: HorizontalBarChartProps) {
  const config: ChartConfig = Object.fromEntries(
    bars.map((b) => [b.key, { label: b.label, color: b.color }])
  );

  return (
    <div role="img" aria-label={ariaLabel}>
      <ChartContainer config={config} className="aspect-auto h-[200px] w-full">
        <BarChart data={bars} layout="vertical" margin={{ left: 8, right: 40 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={84}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
          />
          <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
          <Bar dataKey="value" radius={4} isAnimationActive={false}>
            {bars.map((b) => (
              <Cell key={b.key} fill={b.color} />
            ))}
            <LabelList
              dataKey="displayValue"
              position="right"
              className="fill-[var(--app-text-muted)]"
              fontSize={11}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
      <ul className="sr-only">
        {bars.map((b) => (
          <li key={b.key}>{`${b.label}: ${b.displayValue}`}</li>
        ))}
      </ul>
    </div>
  );
}

export function bucketTopSlices(
  items: { key: string; label: string; value: number }[],
  maxSlices: number,
  othersKey: string,
  othersLabel: string
): { key: string; label: string; value: number }[] {
  if (items.length <= maxSlices) return items;
  const head = items.slice(0, maxSlices);
  const rest = items.slice(maxSlices);
  const othersValue = rest.reduce((sum, x) => sum + x.value, 0);
  return [...head, { key: othersKey, label: othersLabel, value: othersValue }];
}
