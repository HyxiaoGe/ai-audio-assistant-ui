import { useEffect, useRef, useState } from "react"
import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { useGlobalStore } from "@/store/global-store"
import type { APIClient } from "@/lib/api-client"
import type { StreamingImage } from "@/types/api"
import {
  buildStreamingImagesFromSummary,
  applyImageReadyToMap,
  mergeStreamingImages,
  hasUnresolvedImages,
  markUnresolvedImagesFailed,
  streamingImagesEqual,
} from "@/lib/summary-images"
import {
  SUMMARY_IMAGE_TIMEOUT_MS,
  SUMMARY_IMAGE_RECONCILE_INTERVAL_MS,
} from "@/lib/summary-constants"

interface UseSummaryImagesParams {
  taskId: string
  taskStatus: string | undefined
  client: APIClient
}

interface UseSummaryImagesResult {
  streamingImages: Map<string, StreamingImage>
  setStreamingImages: Dispatch<SetStateAction<Map<string, StreamingImage>>>
  imagesTimeoutRef: MutableRefObject<number | null>
}

/**
 * 配图(streamingImages)状态簇:拥有 streamingImages Map(仅 overview 用)与 imagesTimeoutRef,
 * 并承载三条 effect —— 全局 WS image_ready 队列 drain、90s pending 超时兜底、completed 后 4s DB 对账轮询。
 * setStreamingImages / imagesTimeoutRef 经同名解构注入 useSummaryRegeneration 供其 SSE 路径共写。
 */
export function useSummaryImages({
  taskId,
  taskStatus,
  client,
}: UseSummaryImagesParams): UseSummaryImagesResult {
  // State for streaming images in summary (for overview only)
  const [streamingImages, setStreamingImages] = useState<Map<string, StreamingImage>>(new Map())
  const imagesTimeoutRef = useRef<number | null>(null)

  // 渐进式展示：订阅全局 store 里本任务的 image_ready 事件队列，逐条 patch 进 streamingImages，
  // 再清空已消费的事件（事件量极小，图 max 3 张）。
  const imageReadyQueue = useGlobalStore((state) => state.imageReadyEvents[taskId || ""])
  const clearImageReadyEvents = useGlobalStore((state) => state.clearImageReadyEvents)

  useEffect(() => {
    if (!taskId) return
    if (!imageReadyQueue || imageReadyQueue.length === 0) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStreamingImages((prev) => {
      let next = prev
      for (const evt of imageReadyQueue) {
        next = applyImageReadyToMap(next, evt)
      }
      return next
    })
    clearImageReadyEvents(taskId)
  }, [taskId, imageReadyQueue, clearImageReadyEvents])

  // 渐进式展示·全局-WS 路径的 pending 超时兜底：页面加载后图片靠上面的全局 WS image_ready 逐张补；
  // 若 worker 崩溃 / 图数超过后端 max_images，某些占位符将永远收不到 image_ready 而无限转圈——
  // 这违背本功能「用户不用一直等」的初衷。故只要还有 pending/generating 图就武装一个超时；任意一张图
  // 落地（图集变化=有进展）都会重置该窗口（即「连续 SUMMARY_IMAGE_TIMEOUT_MS 无进展」才判失败），
  // 到点把仍未就绪的占位符标为 failed。与 SSE/重新生成路径同一常量、同一失败语义，行为一致。
  useEffect(() => {
    // 无未就绪图：不武装；上一把（若有）已由上一次 effect 的 cleanup 清掉。
    if (!hasUnresolvedImages(streamingImages)) return
    // 用闭包持有句柄并在 cleanup 里清——React 在每次重跑前及卸载时都会执行 cleanup，
    // 故「图集变化重置窗口」与「卸载清定时器」都自洽（避免挂载时快照 ref 造成的清理失效）。
    const handle = window.setTimeout(() => {
      setStreamingImages((prev) => markUnresolvedImagesFailed(prev))
    }, SUMMARY_IMAGE_TIMEOUT_MS)
    return () => window.clearTimeout(handle)
  }, [streamingImages])

  // 渐进式展示·配图对账兜底：配图是任务 completed【之后】才异步逐张生成的（见后端 YouTube 管线），
  // 而把占位符换成真图的唯一实时机制是一次性 WS image_ready（Redis pub/sub，无持久化/无重放）。
  // 该窗口内若 WS 漏收（慢隧道断线重连 / 页面切后台 / 事件早于客户端重订阅），事件永久丢失，
  // 占位符停在 pending 直到上面的 90s 兜底翻成 failed——但此时 DB 里 summary.images 其实早已 ready。
  // 故 completed 且仍有未就绪图时，定时重拉 getSummary 与 DB 对账：mergeStreamingImages 幂等
  // （本地已到终态胜过陈旧 DB pending，DB 终态始终采用），全部就绪或被 90s 兜底判失败后 hasUnresolvedImages
  // 转 false 即自动停。仅读写 streamingImages，与转写状态(三态/生成中/提早整块)完全正交，不互相影响。
  useEffect(() => {
    if (!taskId) return
    if (taskStatus !== "completed") return
    if (!hasUnresolvedImages(streamingImages)) return
    let cancelled = false
    const handle = window.setInterval(() => {
      void (async () => {
        const result = await client.getSummary(taskId).catch(() => null)
        if (cancelled || !result) return
        const dbImages = buildStreamingImagesFromSummary(result.items)
        // DB 暂无图集（异常/版本切换竞态）：不要用空集合覆盖已显示的占位符（反复轮询会放大此风险）。
        if (dbImages.size === 0) return
        // 内容无变化时保留原引用：避免 mergeStreamingImages 的新 Map 引用被 90s 兜底误判为「有进展」
        // 而无限重置其窗口（那样真卡住的图永远不会被判失败）。仅 DB 真有进展才更新+重置兜底窗口。
        setStreamingImages((prev) => {
          const merged = mergeStreamingImages(prev, dbImages)
          return streamingImagesEqual(prev, merged) ? prev : merged
        })
      })()
    }, SUMMARY_IMAGE_RECONCILE_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(handle)
    }
  }, [taskId, taskStatus, streamingImages, client])

  return { streamingImages, setStreamingImages, imagesTimeoutRef }
}
