import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cloneElement, type ReactElement } from "react";

const mockClient = vi.hoisted(() => ({
  getServiceStatsOverview: vi.fn(),
  getTaskStatsOverview: vi.fn(),
  getTaskStatsTimeseries: vi.fn(),
}));
const i18n = vi.hoisted(() => ({ t: (k: string) => k }));

vi.mock("recharts", async (importActual) => {
  const actual = await importActual<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) =>
      cloneElement(children as ReactElement<{ width?: number; height?: number }>, { width: 400, height: 300 }),
  };
});
vi.mock("@/lib/use-api-client", () => ({ useAPIClient: () => mockClient }));
vi.mock("@/lib/i18n-context", () => ({ useI18n: () => ({ locale: "zh", t: i18n.t }) }));
vi.mock("@/store/auth-store", () => ({
  useAuthStore: (sel: (s: { user: { id: string } | null }) => unknown) => sel({ user: { id: "u1" } }),
}));
vi.mock("@/store/ui-store", () => ({
  useUIStore: (sel: (s: { openLogin: () => void }) => unknown) => sel({ openLogin: vi.fn() }),
}));

import Stats from "./Stats";

const taskOverview = {
  time_range: { start: "", end: "" },
  total_tasks: 10,
  status_distribution: { pending: 1, processing: 1, completed: 7, failed: 1 },
  success_rate: 70,
  failure_rate: 10,
  avg_processing_time_seconds: 30,
  median_processing_time_seconds: 25,
  processing_time_by_stage: { transcribe: 42, download: 21 },
  total_audio_duration_seconds: 600,
  total_audio_duration_formatted: "10:00",
};
const serviceOverview = {
  time_range: { start: "", end: "" },
  total_calls: 0,
  usage_by_service_type: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Stats 首屏轻量骨架", () => {
  it("首屏加载(无数据)在任务面板渲染骨架占位", async () => {
    mockClient.getServiceStatsOverview.mockReturnValue(new Promise(() => {})); // pending
    mockClient.getTaskStatsOverview.mockReturnValue(new Promise(() => {}));
    render(<Stats />);
    expect((await screen.findAllByTestId("stats-skeleton")).length).toBeGreaterThan(0);
  });
});

describe("Stats 任务统计图表", () => {
  it("有数据时渲染状态环形图(role=img)与阶段条形图", async () => {
    mockClient.getServiceStatsOverview.mockResolvedValue(serviceOverview);
    mockClient.getTaskStatsOverview.mockResolvedValue(taskOverview);
    render(<Stats />);
    // 状态环形图(t mock 返回 key,故 aria-label = "stats.statusChartAria")
    expect(
      await screen.findByRole("img", { name: "stats.statusChartAria" })
    ).toBeInTheDocument();
    // 阶段条形图
    expect(
      screen.getByRole("img", { name: "stats.stageChartAria" })
    ).toBeInTheDocument();
  });
});

describe("Stats 服务统计供应商图表", () => {
  it("有供应商数据时,展开态渲染 ASR 与 LLM 占比环形图", async () => {
    mockClient.getTaskStatsOverview.mockResolvedValue(taskOverview);
    mockClient.getServiceStatsOverview.mockResolvedValue({
      time_range: { start: "", end: "" },
      total_calls: 12,
      usage_by_service_type: [],
      asr_usage_by_provider: [
        { service_type: "asr", provider: "tencent", call_count: 8, success_rate: 100, failure_rate: 0 },
      ],
      llm_usage_by_provider: [
        { service_type: "llm", provider: "deepseek", call_count: 4, success_rate: 100, failure_rate: 0 },
      ],
    });
    render(<Stats />);
    // 两个供应商卡默认 open(asrProvidersOpen/llmProvidersOpen 初值 true)
    expect(
      await screen.findByRole("img", { name: "stats.asrProviderChartAria" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "stats.llmProviderChartAria" })
    ).toBeInTheDocument();
  });
});

describe("Stats 任务趋势时序图", () => {
  it("有时序数据时在任务区渲染趋势图(role=img)", async () => {
    mockClient.getServiceStatsOverview.mockResolvedValue(serviceOverview);
    mockClient.getTaskStatsOverview.mockResolvedValue(taskOverview);
    mockClient.getTaskStatsTimeseries.mockResolvedValue({
      time_range: { start: "", end: "" },
      timezone: "Asia/Shanghai",
      granularity: "day",
      buckets: [
        { date: "2026-06-20", total: 3, completed: 2, failed: 1, processing: 0, pending: 0, audio_duration_seconds: 120, asr_cost: 0.05 },
        { date: "2026-06-21", total: 2, completed: 2, failed: 0, processing: 0, pending: 0, audio_duration_seconds: 60, asr_cost: 0.02 },
      ],
    });
    render(<Stats />);
    expect(
      await screen.findByRole("img", { name: "stats.trendChartAria" })
    ).toBeInTheDocument();
  });
});
