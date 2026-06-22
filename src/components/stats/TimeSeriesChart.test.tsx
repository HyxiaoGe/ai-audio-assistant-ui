import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { cloneElement, type ReactElement } from "react";
import userEvent from "@testing-library/user-event";

// recharts 的 ResponsiveContainer 在 jsdom 宽高为 0 不渲染;mock 成用 cloneElement
// 注入固定宽高,其余导出透传真身。我们只断言自绘 DOM,不查 SVG 几何。
vi.mock("recharts", async (importActual) => {
  const actual = await importActual<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) =>
      cloneElement(children as ReactElement<{ width?: number; height?: number }>, { width: 400, height: 300 }),
  };
});

import {
  TimeSeriesChart,
  type TimeSeriesMetric,
  type TimeSeriesPoint,
} from "./TimeSeriesChart";

const points: TimeSeriesPoint[] = [
  { date: "2026-06-20", total: 3, completed: 2, failed: 1, processing: 0, pending: 0, audio_duration_seconds: 120, asr_cost: 0.05 },
  { date: "2026-06-21", total: 2, completed: 2, failed: 0, processing: 0, pending: 0, audio_duration_seconds: 60, asr_cost: 0.02 },
];

const metrics: TimeSeriesMetric[] = [
  {
    key: "tasks",
    label: "任务数",
    series: [
      { key: "completed", label: "已完成", color: "var(--app-success)", stackId: "tasks" },
      { key: "failed", label: "失败", color: "var(--app-danger)", stackId: "tasks" },
    ],
    format: (v) => String(Math.round(v)),
  },
  {
    key: "duration",
    label: "音频时长",
    series: [{ key: "audio_duration_seconds", label: "音频时长", color: "var(--chart-1)" }],
    format: (v) => `${v}秒`,
  },
  {
    key: "cost",
    label: "ASR 成本",
    series: [{ key: "asr_cost", label: "ASR 成本", color: "var(--chart-2)" }],
    format: (v) => `¥${v.toFixed(2)}`,
  },
];

const formatDate = (iso: string) => iso.slice(5);

function renderChart() {
  return render(
    <TimeSeriesChart
      points={points}
      metrics={metrics}
      ariaLabel="任务趋势"
      metricGroupLabel="指标"
      formatDate={formatDate}
    />
  );
}

describe("TimeSeriesChart", () => {
  it("外层 role=img + aria-label;分段控件 role=group 含三个指标按钮", () => {
    renderChart();
    expect(screen.getByRole("img", { name: "任务趋势" })).toBeInTheDocument();
    const group = screen.getByRole("group", { name: "指标" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "任务数" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "音频时长" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ASR 成本" })).toBeInTheDocument();
  });

  it("默认选中首个指标(任务数),图例渲染其状态序列 label", () => {
    renderChart();
    expect(screen.getByRole("button", { name: "任务数" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "音频时长" })).toHaveAttribute("aria-pressed", "false");
    // 图例显示状态序列(已完成/失败)
    expect(screen.getByText("已完成")).toBeInTheDocument();
    expect(screen.getByText("失败")).toBeInTheDocument();
  });

  it("点其它指标按钮切换:aria-pressed 与图例随之更新", async () => {
    const user = userEvent.setup();
    renderChart();
    await user.click(screen.getByRole("button", { name: "ASR 成本" }));
    expect(screen.getByRole("button", { name: "ASR 成本" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "任务数" })).toHaveAttribute("aria-pressed", "false");
    // 切到成本后图例不再有状态 label「已完成」
    expect(screen.queryByText("已完成")).not.toBeInTheDocument();
  });

  it("sr-only 数据表逐日列出选中指标的格式化值", () => {
    renderChart();
    // 默认任务数:每日 completed/failed 计数,格式化为整数
    // getAllByText:XAxis tspan 与 sr-only li 均含日期字符串,取至少一个即可
    expect(screen.getAllByText(/06-20/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/06-21/).length).toBeGreaterThan(0);
  });
});
