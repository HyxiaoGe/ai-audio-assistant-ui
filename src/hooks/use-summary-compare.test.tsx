import { renderHook, act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeEventSource, installFakeEventSource } from "@/test-utils/fake-event-source";
import { useSummaryCompare } from "@/hooks/use-summary-compare";

const apiMock = vi.hoisted(() => ({
  compareSummaries: vi.fn(),
  getSummaryComparison: vi.fn(),
  activateSummary: vi.fn(),
  getSummary: vi.fn(),
  mintStreamTicket: vi.fn(),
}));
vi.mock("@/lib/use-api-client", () => ({ useAPIClient: () => apiMock }));
vi.mock("@/lib/i18n-context", () => ({ useI18n: () => ({ t: (k: string) => k, locale: "zh" }) }));
vi.mock("@/lib/notify", () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }));

const llmModels = [
  { provider: "gemini", model_id: "gemini-pro", display_name: "Gemini Pro", provider_display: "Google", is_available: true, is_recommended: true, cost_tier: null },
  { provider: "deepseek", model_id: "deepseek-chat", display_name: "DeepSeek Chat", provider_display: "DeepSeek", is_available: true, is_recommended: false, cost_tier: null },
] as unknown as Parameters<typeof useSummaryCompare>[0]["llmModels"];

function setup(buildSummaryState = vi.fn()) {
  return renderHook(() =>
    useSummaryCompare({ taskId: "t1", llmModels, activeTab: "summary", buildSummaryState })
  );
}

let restore: () => void;
beforeEach(() => {
  restore = installFakeEventSource();
  apiMock.compareSummaries.mockReset().mockResolvedValue({ comparison_id: "cmp1" });
  apiMock.getSummaryComparison.mockReset();
  apiMock.activateSummary.mockReset().mockResolvedValue({});
  apiMock.getSummary.mockReset().mockResolvedValue({ items: [] });
  apiMock.mintStreamTicket.mockReset().mockResolvedValue({ token: "tkn" });
});
afterEach(() => {
  restore?.();
  vi.clearAllMocks();
});

describe("useSummaryCompare", () => {
  it("openCompareDialog 默认选中两个可用模型并打开弹窗", () => {
    const { result } = setup();
    act(() => result.current.openCompareDialog());
    expect(result.current.compareDialogOpen).toBe(true);
    expect(result.current.compareSelectedModels.length).toBe(2);
  });

  it("startCompare SSE:逐模型 started/delta/completed upsert,达 expected 关流停 loading", async () => {
    const { result } = setup();
    act(() => result.current.openCompareDialog());
    await act(async () => {
      await result.current.startCompare();
    });
    expect(result.current.compareMode).toBe(true);
    const es = FakeEventSource.last()!;
    expect(es).toBeDefined();
    act(() => {
      es.emit("summary.started", { model_id: "gemini-pro" });
      es.emit("summary.delta", { model_id: "gemini-pro", content: "G" });
      es.emit("summary.completed", { model_id: "gemini-pro", summary_id: "s-g" });
      es.emit("summary.started", { model_id: "deepseek-chat" });
      es.emit("summary.completed", { model_id: "deepseek-chat", summary_id: "s-d" });
    });
    await waitFor(() => expect(result.current.compareLoading).toBe(false));
    expect(es.closed).toBe(true);
    expect(result.current.comparisonResults.filter((r) => r.status === "completed").length).toBe(2);
  });

  it("getModelKey 归一:provider 与 model_id 都归到 model_id", () => {
    const { result } = setup();
    expect(result.current.getModelKey("gemini")).toBe("gemini-pro");
    expect(result.current.getModelKey("gemini-pro")).toBe("gemini-pro");
  });

  it("activateComparisonResult 调注入的 buildSummaryState 并退出对比", async () => {
    const build = vi.fn();
    apiMock.getSummary.mockResolvedValue({ items: [{ summary_type: "overview", is_active: true, content: "x" }] });
    const { result } = setup(build);
    await act(async () => {
      await result.current.activateComparisonResult("s-g");
    });
    expect(apiMock.activateSummary).toHaveBeenCalledWith("t1", "s-g");
    expect(build).toHaveBeenCalledWith([{ summary_type: "overview", is_active: true, content: "x" }]);
    expect(result.current.compareMode).toBe(false);
  });

  it("clearCompare 全清并 close compareStream + clearInterval comparePoll", async () => {
    const { result } = setup();
    act(() => result.current.openCompareDialog());
    await act(async () => {
      await result.current.startCompare();
    });
    const es = FakeEventSource.last()!;
    act(() => result.current.clearCompare());
    expect(result.current.compareMode).toBe(false);
    expect(result.current.comparisonResults).toEqual([]);
    expect(es.closed).toBe(true);
  });
});
