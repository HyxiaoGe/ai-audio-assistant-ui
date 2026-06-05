import type { StreamingImage, SummaryItem, WsImageReadyData } from "@/types/api"
import { extractPlaceholderDescription } from "@/lib/image-placeholder"

/**
 * 把一组摘要项里「active overview」的持久图集 images[] 转成 streamingImages Map。
 * key 为 placeholder 字符串本身（与 MarkdownContent 的 streamingImages.get(placeholder) 对齐）。
 * SummaryImage.status("pending"|"ready"|"failed") 与 StreamingImage.status 同名直映（无 generating）。
 * 非 overview / 无 active overview / images 为 null|[] 时返回空 Map。
 */
export function buildStreamingImagesFromSummary(
  items: SummaryItem[]
): Map<string, StreamingImage> {
  const map = new Map<string, StreamingImage>()
  const overview = items.find(
    (item) => item.summary_type === "overview" && item.is_active
  )
  const images = overview?.images
  if (!images || images.length === 0) {
    return map
  }
  for (const image of images) {
    map.set(image.placeholder, {
      placeholder: image.placeholder,
      // 优先用后端给的 alt 作展示文案；缺省回退到从占位符解析的描述。
      description: image.alt || extractPlaceholderDescription(image.placeholder),
      url: image.status === "ready" ? image.url : null,
      status: image.status,
    })
  }
  return map
}

/**
 * 把一条全局 WS image_ready 事件就地 patch 进 streamingImages Map（不可变，返回新 Map）。
 * 注意：image_ready 事件的 status 取值为 "ready"|"failed"（与旧 SSE image.ready 的 "success" 不同）。
 * 未知 placeholder 时新增一项（兜底，正常情况下初始化时已存在）。
 */
export function applyImageReadyToMap(
  prev: Map<string, StreamingImage>,
  evt: WsImageReadyData
): Map<string, StreamingImage> {
  const next = new Map(prev)
  const existing = next.get(evt.placeholder)
  next.set(evt.placeholder, {
    placeholder: evt.placeholder,
    description:
      existing?.description || extractPlaceholderDescription(evt.placeholder),
    url: evt.status === "ready" ? evt.url : null,
    status: evt.status,
  })
  return next
}

/**
 * 合并两份 streamingImages Map：completed 重载重拉 DB 持久图集时，DB 快照可能滞后于已到达的
 * image_ready WS（本地某占位符已被 patch 成 ready+url，DB 里还是 pending）。直接用 incoming 整体替换
 * 会把已显示的图退回占位且不会重放 WS。故以 incoming（DB 的权威占位符全集）为键集逐项合并：
 * 仅当 prev 已到达「终态」（ready+url 或 failed）、而 incoming 该项尚未到终态（仍 pending/generating）时，
 * 保留 prev——本地经 WS 先到的终态胜过陈旧的 DB pending（不仅 ready，failed 同样要保，否则一张已失败的图会被
 * 滞后的 DB pending 复活成转圈直到超时）。其余一律采用 incoming（incoming 自身的终态始终生效）。
 * prev 独有、incoming 没有的占位符会被丢弃（incoming 才是当前摘要的权威占位符全集）。
 */
export function mergeStreamingImages(
  prev: Map<string, StreamingImage>,
  incoming: Map<string, StreamingImage>
): Map<string, StreamingImage> {
  const isResolved = (img: StreamingImage): boolean =>
    (img.status === "ready" && !!img.url) || img.status === "failed"
  const next = new Map<string, StreamingImage>()
  for (const [placeholder, incomingItem] of incoming) {
    const prevItem = prev.get(placeholder)
    if (prevItem && isResolved(prevItem) && !isResolved(incomingItem)) {
      next.set(placeholder, prevItem)
    } else {
      next.set(placeholder, incomingItem)
    }
  }
  return next
}

/**
 * 两份图集内容是否等价（占位符集合一致，且各项 status+url 都相同）。
 * 对账轮询(completed 后定时重拉 DB 图集)用：mergeStreamingImages 总是返回新 Map 引用，
 * 若 DB 无进展也照样 setState，会被「图集变化=有进展」的超时兜底误判为进展而无限重置 90s 窗口。
 * 故轮询合并后用本函数比较，内容未变就保留原引用(返回 prev)、不触发重渲染、不重置超时窗口。
 */
export function streamingImagesEqual(
  a: Map<string, StreamingImage>,
  b: Map<string, StreamingImage>
): boolean {
  if (a === b) return true
  if (a.size !== b.size) return false
  for (const [key, av] of a) {
    const bv = b.get(key)
    if (!bv || bv.status !== av.status || bv.url !== av.url) return false
  }
  return true
}

/** 任意一张图仍是 pending/generating（未就绪）。超时兜底据此判断是否还要继续等。 */
export function hasUnresolvedImages(map: Map<string, StreamingImage>): boolean {
  for (const img of map.values()) {
    if (img.status === "pending" || img.status === "generating") {
      return true
    }
  }
  return false
}

/**
 * 超时兜底的纯变换：把仍 pending/generating 的占位符标记为 failed（url 置空）。
 * 无可改项时原样返回同一引用（避免 setState 引发无谓重渲染）；否则返回新 Map（不可变）。
 */
export function markUnresolvedImagesFailed(
  prev: Map<string, StreamingImage>
): Map<string, StreamingImage> {
  let changed = false
  const next = new Map(prev)
  for (const [key, img] of next) {
    if (img.status === "pending" || img.status === "generating") {
      next.set(key, { ...img, url: null, status: "failed" })
      changed = true
    }
  }
  return changed ? next : prev
}
