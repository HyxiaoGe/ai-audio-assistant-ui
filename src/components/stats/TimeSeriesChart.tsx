"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";

export interface TimeSeriesPoint {
  date: string;
  total: number;
  completed: number;
  failed: number;
  processing: number;
  pending: number;
  audio_duration_seconds: number;
  asr_cost: number;
}

export interface TimeSeriesSeries {
  key: string;
  label: string;
  color: string;
  stackId?: string;
}

export interface TimeSeriesMetric {
  key: string;
  label: string;
  series: TimeSeriesSeries[];
  format: (value: number) => string;
}

export interface TimeSeriesChartProps {
  points: TimeSeriesPoint[];
  metrics: TimeSeriesMetric[];
  ariaLabel: string;
  metricGroupLabel: string;
  formatDate: (iso: string) => string;
}

function valueOf(point: TimeSeriesPoint, key: string): number {
  const v = (point as unknown as Record<string, number>)[key];
  return typeof v === "number" ? v : 0;
}

export function TimeSeriesChart({
  points,
  metrics,
  ariaLabel,
  metricGroupLabel,
  formatDate,
}: TimeSeriesChartProps) {
  const [selectedKey, setSelectedKey] = useState(metrics[0]?.key ?? "");
  const selected = metrics.find((m) => m.key === selectedKey) ?? metrics[0];

  const config: ChartConfig = Object.fromEntries(
    selected.series.map((s) => [s.key, { label: s.label, color: s.color }])
  );

  return (
    <div role="img" aria-label={ariaLabel} className="space-y-3">
      <div
        role="group"
        aria-label={metricGroupLabel}
        className="flex flex-wrap gap-1.5"
      >
        {metrics.map((m) => {
          const active = m.key === selected.key;
          return (
            <Button
              key={m.key}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              aria-pressed={active}
              onClick={() => setSelectedKey(m.key)}
            >
              {m.label}
            </Button>
          );
        })}
      </div>

      <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
        <AreaChart data={points} margin={{ left: 4, right: 12, top: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(v: number) => selected.format(v)}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            width={48}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          {selected.series.map((s) => (
            <Area
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId={s.stackId}
              type="monotone"
              stroke={s.color}
              fill={s.color}
              fillOpacity={0.25}
              strokeWidth={2}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ChartContainer>

      <ul className="space-y-1.5">
        {selected.series.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: s.color }}
              aria-hidden="true"
            />
            <span className="text-[var(--app-text)]">{s.label}</span>
          </li>
        ))}
      </ul>

      <ul className="sr-only">
        {points.map((p) => (
          <li key={p.date}>
            {`${formatDate(p.date)} — ${selected.series
              .map((s) => `${s.label} ${selected.format(valueOf(p, s.key))}`)
              .join(", ")}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
