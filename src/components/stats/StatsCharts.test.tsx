import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { cloneElement, type ReactElement } from "react";

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

import { DonutChart, HorizontalBarChart, bucketTopSlices, CHART_PALETTE } from "./StatsCharts";

describe("bucketTopSlices", () => {
  it("项数 <= maxSlices 时原样返回", () => {
    const items = [
      { key: "a", label: "A", value: 3 },
      { key: "b", label: "B", value: 2 },
    ];
    expect(bucketTopSlices(items, 5, "__others__", "其它")).toEqual(items);
  });

  it("超出 maxSlices 时把其余累加成单片其它", () => {
    const items = [
      { key: "a", label: "A", value: 10 },
      { key: "b", label: "B", value: 8 },
      { key: "c", label: "C", value: 6 },
      { key: "d", label: "D", value: 4 },
      { key: "e", label: "E", value: 2 },
      { key: "f", label: "F", value: 1 },
      { key: "g", label: "G", value: 1 },
    ];
    const out = bucketTopSlices(items, 5, "__others__", "其它");
    expect(out).toHaveLength(6);
    expect(out[5]).toEqual({ key: "__others__", label: "其它", value: 2 });
  });
});

describe("DonutChart", () => {
  const slices = [
    { key: "completed", label: "已完成", value: 7, color: "var(--app-success)" },
    { key: "failed", label: "失败", value: 3, color: "var(--app-danger)" },
  ];

  it("自绘图例渲染每片 label、数值与占比", () => {
    render(<DonutChart slices={slices} ariaLabel="任务状态分布" />);
    expect(screen.getByText("已完成")).toBeInTheDocument();
    expect(screen.getByText("失败")).toBeInTheDocument();
    expect(screen.getByText("70%")).toBeInTheDocument(); // 7/10
    expect(screen.getByText("30%")).toBeInTheDocument(); // 3/10
  });

  it("渲染中心文字(与图例占比互不干扰)", () => {
    // centerPrimary 用 78%(非图例里的 70%/30%),centerSecondary 用非 label 文案,
    // 保证查询唯一命中中心文字,验证图例占比列仍保留(不被中心文字逻辑误删)。
    render(
      <DonutChart
        slices={slices}
        centerPrimary="78%"
        centerSecondary="完成率"
        ariaLabel="任务状态分布"
      />
    );
    expect(screen.getByText("78%")).toBeInTheDocument();
    expect(screen.getByText("完成率")).toBeInTheDocument();
    // 图例占比列依旧渲染
    expect(screen.getByText("70%")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
  });

  it("外层有 role=img 与 aria-label", () => {
    render(<DonutChart slices={slices} ariaLabel="任务状态分布" />);
    expect(screen.getByRole("img", { name: "任务状态分布" })).toBeInTheDocument();
  });

  it("空 slices 不崩溃且仍有 role=img", () => {
    render(<DonutChart slices={[]} ariaLabel="任务状态分布" />);
    expect(screen.getByRole("img", { name: "任务状态分布" })).toBeInTheDocument();
  });

  it("CHART_PALETTE 暴露 5 个 --chart token", () => {
    expect(CHART_PALETTE).toHaveLength(5);
    expect(CHART_PALETTE[0]).toBe("var(--chart-1)");
  });
});

describe("HorizontalBarChart", () => {
  const bars = [
    { key: "transcribe", label: "转写", value: 42, displayValue: "42.0 秒", color: "var(--chart-1)" },
    { key: "download", label: "下载", value: 21, displayValue: "21.0 秒", color: "var(--chart-2)" },
  ];

  it("sr-only 列表渲染每条 label 与 displayValue", () => {
    render(<HorizontalBarChart bars={bars} ariaLabel="各阶段平均耗时" />);
    expect(screen.getByText("转写: 42.0 秒")).toBeInTheDocument();
    expect(screen.getByText("下载: 21.0 秒")).toBeInTheDocument();
  });

  it("外层有 role=img 与 aria-label", () => {
    render(<HorizontalBarChart bars={bars} ariaLabel="各阶段平均耗时" />);
    expect(screen.getByRole("img", { name: "各阶段平均耗时" })).toBeInTheDocument();
  });
});
