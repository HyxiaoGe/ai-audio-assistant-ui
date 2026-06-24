import { renderHook, act } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useGlobalStore } from "@/store/global-store"
import type { APIClient } from "@/lib/api-client"
import type { StreamingImage } from "@/types/api"
import {
  SUMMARY_IMAGE_TIMEOUT_MS,
  SUMMARY_IMAGE_RECONCILE_INTERVAL_MS,
} from "@/lib/summary-constants"
import { useSummaryImages } from "./use-summary-images"

const PH = "{{IMAGE: 时间轴}}"

function pendingMap(): Map<string, StreamingImage> {
  return new Map<string, StreamingImage>([
    [PH, { placeholder: PH, description: "时间轴", url: null, status: "pending" }],
  ])
}

function readyMap(): Map<string, StreamingImage> {
  return new Map<string, StreamingImage>([
    [PH, { placeholder: PH, description: "时间轴", url: "/img/t.png", status: "ready" }],
  ])
}

// 仅需 getSummary;其余 APIClient 方法本 hook 不触达,断言用 unknown 转型即可。
function makeClient(getSummary: ReturnType<typeof vi.fn>): APIClient {
  return { getSummary } as unknown as APIClient
}

beforeEach(() => {
  useGlobalStore.setState({ tasks: {}, imageReadyEvents: {} })
})

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe("useSummaryImages", () => {
  it("WS drain:image_ready 事件逐条 patch 进 streamingImages 并清空全局队列", () => {
    useGlobalStore.setState({
      imageReadyEvents: {
        t1: [
          {
            task_id: "t1",
            summary_id: "s1",
            summary_type: "overview",
            placeholder: PH,
            status: "ready",
            url: "/img/t.png",
            model_id: "gemini",
          },
        ],
      },
    })
    const client = makeClient(vi.fn())
    const { result } = renderHook(() =>
      useSummaryImages({ taskId: "t1", taskStatus: "completed", client })
    )
    const img = result.current.streamingImages.get(PH)
    expect(img?.status).toBe("ready")
    expect(img?.url).toBe("/img/t.png")
    // clearImageReadyEvents 删除 key
    expect(useGlobalStore.getState().imageReadyEvents["t1"]).toBeUndefined()
  })

  it("90s 兜底:仍 pending 的图到点翻 failed", async () => {
    vi.useFakeTimers()
    // ⚠️ taskStatus='completed' + pending 会同时武装 4s 对账 interval;90s 推进期它每 tick 调 client.getSummary。
    // 故 client 必须返回【可链式 Promise】——裸 vi.fn() 返回 undefined,interval 内 `.catch` on undefined →
    // TypeError → unhandled rejection ×~22 → 整个套件退出码=1(用例本身仍绿、套件红,极难诊断)。让 getSummary
    // 恒返回 pending:对账每 tick merged≡prev → streamingImagesEqual 命中保留原引用、不重置 90s 窗口,故 90s 仍到点。
    const getSummary = vi.fn().mockResolvedValue({
      items: [
        {
          summary_type: "overview",
          is_active: true,
          content: `概览 ${PH}`,
          images: [
            {
              placeholder: PH,
              status: "pending",
              url: null,
              alt: "时间轴",
              model_id: null,
              error: null,
            },
          ],
        },
      ],
    })
    const client = makeClient(getSummary)
    const { result } = renderHook(() =>
      useSummaryImages({ taskId: "t1", taskStatus: "completed", client })
    )
    act(() => {
      result.current.setStreamingImages(pendingMap())
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SUMMARY_IMAGE_TIMEOUT_MS)
    })
    expect(result.current.streamingImages.get(PH)?.status).toBe("failed")
    expect(result.current.streamingImages.get(PH)?.url).toBeNull()
  })

  it("4s 对账:completed 且仍 pending 时轮询 getSummary,用 DB ready 替换占位", async () => {
    vi.useFakeTimers()
    const getSummary = vi.fn().mockResolvedValue({
      items: [
        {
          summary_type: "overview",
          is_active: true,
          content: `概览 ${PH}`,
          images: [
            {
              placeholder: PH,
              status: "ready",
              url: "/img/t.png",
              alt: "时间轴",
              model_id: null,
              error: null,
            },
          ],
        },
      ],
    })
    const client = makeClient(getSummary)
    const { result } = renderHook(() =>
      useSummaryImages({ taskId: "t1", taskStatus: "completed", client })
    )
    act(() => {
      result.current.setStreamingImages(pendingMap())
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SUMMARY_IMAGE_RECONCILE_INTERVAL_MS)
    })
    expect(getSummary).toHaveBeenCalledWith("t1")
    expect(result.current.streamingImages.get(PH)?.status).toBe("ready")
    expect(result.current.streamingImages.get(PH)?.url).toBe("/img/t.png")
  })

  it("4s 对账幂等:DB 仍 pending(内容无变化)时保留原 Map 引用(不重置 90s 窗口)", async () => {
    vi.useFakeTimers()
    const getSummary = vi.fn().mockResolvedValue({
      items: [
        {
          summary_type: "overview",
          is_active: true,
          content: `概览 ${PH}`,
          images: [
            {
              placeholder: PH,
              status: "pending",
              url: null,
              alt: "时间轴",
              model_id: null,
              error: null,
            },
          ],
        },
      ],
    })
    const client = makeClient(getSummary)
    const { result } = renderHook(() =>
      useSummaryImages({ taskId: "t1", taskStatus: "completed", client })
    )
    act(() => {
      result.current.setStreamingImages(pendingMap())
    })
    const before = result.current.streamingImages
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SUMMARY_IMAGE_RECONCILE_INTERVAL_MS)
    })
    expect(getSummary).toHaveBeenCalledWith("t1")
    // streamingImagesEqual 命中 → 返回 prev 同一引用,避免新 Map 被 90s 兜底误判为「有进展」
    expect(result.current.streamingImages).toBe(before)
  })

  it("守卫:全就绪时 90s 不武装、非 completed 时 4s 不轮询", async () => {
    vi.useFakeTimers()
    const getSummary = vi.fn()
    const client = makeClient(getSummary)
    const { result } = renderHook(() =>
      useSummaryImages({ taskId: "t1", taskStatus: "summarizing", client })
    )
    act(() => {
      result.current.setStreamingImages(readyMap())
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        SUMMARY_IMAGE_TIMEOUT_MS + SUMMARY_IMAGE_RECONCILE_INTERVAL_MS
      )
    })
    // 全 ready → hasUnresolvedImages 假 → 90s 未武装,仍 ready
    expect(result.current.streamingImages.get(PH)?.status).toBe("ready")
    // taskStatus !== "completed" → 4s 早返回,getSummary 从未被调用
    expect(getSummary).not.toHaveBeenCalled()
  })
})
