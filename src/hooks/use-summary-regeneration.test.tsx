import { renderHook, act, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeEventSource, installFakeEventSource } from "@/test-utils/fake-event-source";
import { useSummaryRegeneration, type UseSummaryRegenerationParams } from "./use-summary-regeneration";
import type { StreamingImage } from "@/types/api";

const apiMock = vi.hoisted(() => ({
  getSummary: vi.fn(),
  regenerateSummary: vi.fn(),
  mintStreamTicket: vi.fn(),
}));
vi.mock("@/lib/use-api-client", () => ({ useAPIClient: () => apiMock }));
vi.mock("@/lib/i18n-context", () => ({ useI18n: () => ({ t: (k: string) => k, locale: "zh" }) }));
vi.mock("@/lib/notify", () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }));

function makeParams(over: Partial<UseSummaryRegenerationParams> = {}): UseSummaryRegenerationParams {
  return {
    taskId: "task-1",
    llmModels: [],
    summaryModelSelection: { overview: null, key_points: null, action_items: null },
    summaryVersions: { overview: 0, key_points: 0, action_items: 0 },
    actionItemLabels: { pendingAssignee: "a", pendingDeadline: "d" },
    buildSummaryState: vi.fn(),
    setStreamingImages: vi.fn(),
    imagesTimeoutRef: { current: null },
    setSummaryError: vi.fn(),
    summaryScrollRef: createRef<HTMLDivElement>(),
    summaryAutoScrollRef: { current: true },
    setSummaryOverviewMarkdown: vi.fn(),
    setKeyPointsMarkdown: vi.fn(),
    setKeyPoints: vi.fn(),
    setActionItemsMarkdown: vi.fn(),
    setActionItems: vi.fn(),
    ...over,
  };
}

let restore: () => void;
beforeEach(() => {
  restore = installFakeEventSource();
  apiMock.getSummary.mockReset();
  apiMock.regenerateSummary.mockReset();
  apiMock.mintStreamTicket.mockReset();
  apiMock.getSummary.mockResolvedValue({ task_id: "task-1", total: 0, items: [] });
  apiMock.regenerateSummary.mockResolvedValue({});
  apiMock.mintStreamTicket.mockResolvedValue({ token: "tkn" });
});
afterEach(() => {
  restore?.();
  vi.clearAllMocks();
});

describe("useSummaryRegeneration", () => {
  it("含图 happy:connected→regenerate 一次,completed(has_images) 保持流开,images.completed 关流+回写", async () => {
    const params = makeParams();
    const { result } = renderHook(() => useSummaryRegeneration(params));
    await act(async () => {
      await result.current.regenerateSummary("overview");
    });
    const es = FakeEventSource.last()!;
    expect(es.url).toContain("/summaries/task-1/stream?summary_type=overview&token=tkn");

    await act(async () => { es.emit("connected"); });
    await waitFor(() => expect(apiMock.regenerateSummary).toHaveBeenCalledTimes(1));

    await act(async () => { es.emit("summary.completed", { has_images: true }); });
    expect(es.closed).toBe(false);

    await act(async () => { es.emit("images.completed"); });
    expect(es.closed).toBe(true);
    await waitFor(() => expect(params.buildSummaryState).toHaveBeenCalled());
  });

  it("无图 happy:summary.completed(has_images:false) 立即关流", async () => {
    const params = makeParams();
    const { result } = renderHook(() => useSummaryRegeneration(params));
    await act(async () => { await result.current.regenerateSummary("overview"); });
    const es = FakeEventSource.last()!;
    await act(async () => { es.emit("connected"); es.emit("summary.completed", { has_images: false }); });
    expect(es.closed).toBe(true);
  });

  it("token-null:mintStreamTicket 失败→直发 regenerate POST,不构造 EventSource", async () => {
    apiMock.mintStreamTicket.mockRejectedValue(new Error("no ticket"));
    const params = makeParams();
    const { result } = renderHook(() => useSummaryRegeneration(params));
    await act(async () => { await result.current.regenerateSummary("overview"); });
    expect(apiMock.regenerateSummary).toHaveBeenCalledTimes(1);
    expect(FakeEventSource.last()).toBeUndefined();
  });

  it("image.ready(success) 写入 streamingImages 为 ready,且【不】带 model_id(SSE 与 WS/DB 的有意分歧)", async () => {
    const params = makeParams();
    const { result } = renderHook(() => useSummaryRegeneration(params));
    await act(async () => { await result.current.regenerateSummary("overview"); });
    const es = FakeEventSource.last()!;
    await act(async () => {
      es.emit("connected");
      es.emit("image.ready", {
        placeholder: "{{IMAGE: 时间轴}}",
        status: "success",
        url: "https://img/x.png",
        model_id: "should-be-dropped",
        current: 1,
        total: 1,
      });
    });
    // 取最后一次 setStreamingImages 的 updater,套用到空 Map 验证结果条目
    const calls = (params.setStreamingImages as ReturnType<typeof vi.fn>).mock.calls;
    const lastUpdater = calls[calls.length - 1][0] as (prev: Map<string, StreamingImage>) => Map<string, StreamingImage>;
    const next = lastUpdater(new Map());
    const entry = next.get("{{IMAGE: 时间轴}}")!;
    expect(entry.status).toBe("ready");
    expect(entry.url).toBe("https://img/x.png");
    expect("model_id" in entry).toBe(false);
  });

  it("connectionTimeout:无 connected,3s 后补发 regenerate(fake timers)", async () => {
    vi.useFakeTimers();
    try {
      const params = makeParams();
      const { result } = renderHook(() => useSummaryRegeneration(params));
      await act(async () => { await result.current.regenerateSummary("overview"); });
      expect(apiMock.regenerateSummary).not.toHaveBeenCalled();
      await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
      expect(apiMock.regenerateSummary).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("connected 前 onerror:幂等补发 regenerate + 关流", async () => {
    const params = makeParams();
    const { result } = renderHook(() => useSummaryRegeneration(params));
    await act(async () => { await result.current.regenerateSummary("overview"); });
    const es = FakeEventSource.last()!;
    await act(async () => { es.emitTransportError(); });
    await waitFor(() => expect(apiMock.regenerateSummary).toHaveBeenCalledTimes(1));
    expect(es.closed).toBe(true);
  });
});
