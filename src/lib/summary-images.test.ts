import { describe, expect, it } from "vitest"
import {
  buildStreamingImagesFromSummary,
  applyImageReadyToMap,
  mergeStreamingImages,
  hasUnresolvedImages,
  markUnresolvedImagesFailed,
} from "./summary-images"
import type { SummaryImage, SummaryItem, StreamingImage } from "@/types/api"

function summaryItem(over: Partial<SummaryItem> = {}): SummaryItem {
  return {
    id: "s1",
    summary_type: "overview",
    version: 1,
    is_active: true,
    content: "正文 {{IMAGE: infographic | 小米战略 | 关键文字}}",
    model_used: "gemini",
    prompt_version: null,
    token_count: null,
    created_at: "2026-06-03T00:00:00Z",
    images: null,
    ...over,
  }
}

function img(over: Partial<SummaryImage> = {}): SummaryImage {
  return {
    placeholder: "{{IMAGE: infographic | 小米战略 | 关键文字}}",
    status: "pending",
    url: null,
    alt: "小米战略",
    model_id: null,
    error: null,
    ...over,
  }
}

describe("buildStreamingImagesFromSummary", () => {
  it("returns an empty Map when there is no active overview summary", () => {
    const map = buildStreamingImagesFromSummary([
      summaryItem({ summary_type: "key_points", images: [img()] }),
    ])
    expect(map.size).toBe(0)
  })

  it("returns an empty Map when active overview has null/[] images", () => {
    expect(buildStreamingImagesFromSummary([summaryItem({ images: null })]).size).toBe(0)
    expect(buildStreamingImagesFromSummary([summaryItem({ images: [] })]).size).toBe(0)
  })

  it("keys the Map by the placeholder string and maps each status 1:1", () => {
    const map = buildStreamingImagesFromSummary([
      summaryItem({
        images: [
          img({ placeholder: "{{IMAGE: a}}", status: "pending", alt: "a" }),
          img({ placeholder: "{{IMAGE: b}}", status: "ready", url: "/api/v1/summaries/images/b.png", alt: "B图" }),
          img({ placeholder: "{{IMAGE: c}}", status: "failed", error: "boom" }),
        ],
      }),
    ])
    expect(map.get("{{IMAGE: a}}")).toEqual<StreamingImage>({
      placeholder: "{{IMAGE: a}}",
      description: "a",
      url: null,
      status: "pending",
    })
    expect(map.get("{{IMAGE: b}}")?.status).toBe("ready")
    expect(map.get("{{IMAGE: b}}")?.url).toBe("/api/v1/summaries/images/b.png")
    expect(map.get("{{IMAGE: b}}")?.description).toBe("B图")
    expect(map.get("{{IMAGE: c}}")?.status).toBe("failed")
  })

  it("prefers the active overview over inactive duplicates", () => {
    const map = buildStreamingImagesFromSummary([
      summaryItem({ id: "old", is_active: false, images: [img({ placeholder: "{{IMAGE: old}}" })] }),
      summaryItem({ id: "new", is_active: true, images: [img({ placeholder: "{{IMAGE: new}}" })] }),
    ])
    expect(map.has("{{IMAGE: new}}")).toBe(true)
    expect(map.has("{{IMAGE: old}}")).toBe(false)
  })
})

describe("applyImageReadyToMap", () => {
  const base = () =>
    new Map<string, StreamingImage>([
      ["{{IMAGE: a}}", { placeholder: "{{IMAGE: a}}", description: "a", url: null, status: "pending" }],
    ])

  it("patches a known placeholder to ready with its url (returns a new Map)", () => {
    const prev = base()
    const next = applyImageReadyToMap(prev, {
      task_id: "t1",
      summary_id: "s1",
      summary_type: "overview",
      placeholder: "{{IMAGE: a}}",
      status: "ready",
      url: "/api/v1/summaries/images/a.png",
      model_id: "gemini",
    })
    expect(next).not.toBe(prev)
    expect(next.get("{{IMAGE: a}}")).toEqual<StreamingImage>({
      placeholder: "{{IMAGE: a}}",
      description: "a",
      url: "/api/v1/summaries/images/a.png",
      status: "ready",
    })
    // 原 Map 不被原地改动
    expect(prev.get("{{IMAGE: a}}")?.status).toBe("pending")
  })

  it("patches to failed and forcibly nulls the url even if the event carries one", () => {
    // 传一个自相矛盾的事件（status=failed 却带 url）以真正钉住「failed 必置空 url」分支：
    // 若实现退化为 url 直通，本用例会失败。
    const next = applyImageReadyToMap(base(), {
      task_id: "t1",
      summary_id: "s1",
      summary_type: "overview",
      placeholder: "{{IMAGE: a}}",
      status: "failed",
      url: "/should/be/dropped.png",
      model_id: null,
    })
    expect(next.get("{{IMAGE: a}}")?.status).toBe("failed")
    expect(next.get("{{IMAGE: a}}")?.url).toBeNull()
  })

  it("inserts a new entry when the placeholder is not yet in the Map", () => {
    const next = applyImageReadyToMap(base(), {
      task_id: "t1",
      summary_id: "s1",
      summary_type: "overview",
      placeholder: "{{IMAGE: brand new}}",
      status: "ready",
      url: "/api/v1/summaries/images/x.png",
      model_id: "gemini",
    })
    expect(next.get("{{IMAGE: brand new}}")?.status).toBe("ready")
    expect(next.get("{{IMAGE: brand new}}")?.description).toBe("brand new")
  })
})

describe("mergeStreamingImages", () => {
  const ready = (placeholder: string): StreamingImage => ({
    placeholder,
    description: placeholder,
    url: `/api/v1/summaries/images/${placeholder}.png`,
    status: "ready",
  })
  const pending = (placeholder: string): StreamingImage => ({
    placeholder,
    description: placeholder,
    url: null,
    status: "pending",
  })
  const failed = (placeholder: string): StreamingImage => ({
    placeholder,
    description: placeholder,
    url: null,
    status: "failed",
  })

  it("keeps prev's ready+url when the incoming DB snapshot still says pending (WS outran DB)", () => {
    const prev = new Map<string, StreamingImage>([["a", ready("a")]])
    const incoming = new Map<string, StreamingImage>([["a", pending("a")]])
    const merged = mergeStreamingImages(prev, incoming)
    expect(merged.get("a")).toEqual(ready("a"))
  })

  it("takes incoming when it is ready, even if prev was only pending", () => {
    const prev = new Map<string, StreamingImage>([["a", pending("a")]])
    const incoming = new Map<string, StreamingImage>([["a", ready("a")]])
    const merged = mergeStreamingImages(prev, incoming)
    expect(merged.get("a")?.status).toBe("ready")
    expect(merged.get("a")?.url).toBe("/api/v1/summaries/images/a.png")
  })

  it("does NOT keep a prev that is ready but has no url (only true ready beats stale DB)", () => {
    const prevReadyNoUrl: StreamingImage = {
      placeholder: "a",
      description: "a",
      url: null,
      status: "ready",
    }
    const prev = new Map<string, StreamingImage>([["a", prevReadyNoUrl]])
    const incoming = new Map<string, StreamingImage>([["a", pending("a")]])
    const merged = mergeStreamingImages(prev, incoming)
    expect(merged.get("a")?.status).toBe("pending")
  })

  it("keeps prev's failed over a stale incoming pending — a failed image is not revived to a spinner", () => {
    // WS 早到的 failed 事件先把占位符标 failed；随后 loadTask 的滞后 DB 快照仍是 pending。
    // failed 是终态，不应被 pending 复活成转圈（否则要白等到 90s 超时）。
    const prev = new Map<string, StreamingImage>([["a", failed("a")]])
    const incoming = new Map<string, StreamingImage>([["a", pending("a")]])
    const merged = mergeStreamingImages(prev, incoming)
    expect(merged.get("a")?.status).toBe("failed")
  })

  it("takes incoming when incoming itself is terminal (failed), over prev pending", () => {
    const prev = new Map<string, StreamingImage>([["a", pending("a")]])
    const incoming = new Map<string, StreamingImage>([["a", failed("a")]])
    const merged = mergeStreamingImages(prev, incoming)
    expect(merged.get("a")?.status).toBe("failed")
  })

  it("uses incoming as the authoritative key set — drops prev-only placeholders", () => {
    const prev = new Map<string, StreamingImage>([
      ["a", ready("a")],
      ["ghost", ready("ghost")],
    ])
    const incoming = new Map<string, StreamingImage>([["a", pending("a")]])
    const merged = mergeStreamingImages(prev, incoming)
    expect(merged.has("ghost")).toBe(false)
    expect(merged.size).toBe(1)
  })

  it("returns a fresh Map and never mutates prev", () => {
    const prev = new Map<string, StreamingImage>([["a", ready("a")]])
    const incoming = new Map<string, StreamingImage>([["a", pending("a")]])
    const merged = mergeStreamingImages(prev, incoming)
    expect(merged).not.toBe(prev)
    expect(prev.get("a")?.status).toBe("ready")
  })
})

describe("hasUnresolvedImages", () => {
  const mk = (status: StreamingImage["status"]): StreamingImage => ({
    placeholder: "a",
    description: "a",
    url: status === "ready" ? "/x.png" : null,
    status,
  })

  it("is false for an empty Map", () => {
    expect(hasUnresolvedImages(new Map())).toBe(false)
  })

  it("is false when every image is ready or failed (terminal)", () => {
    const map = new Map<string, StreamingImage>([
      ["a", mk("ready")],
      ["b", mk("failed")],
    ])
    expect(hasUnresolvedImages(map)).toBe(false)
  })

  it("is true when any image is pending or generating", () => {
    expect(hasUnresolvedImages(new Map([["a", mk("pending")]]))).toBe(true)
    expect(hasUnresolvedImages(new Map([["a", mk("generating")]]))).toBe(true)
  })
})

describe("markUnresolvedImagesFailed", () => {
  const mk = (status: StreamingImage["status"], url: string | null = null): StreamingImage => ({
    placeholder: "a",
    description: "a",
    url,
    status,
  })

  it("flips pending/generating to failed and nulls their url", () => {
    const prev = new Map<string, StreamingImage>([
      ["a", mk("pending")],
      ["b", mk("generating")],
      ["c", mk("ready", "/c.png")],
    ])
    const next = markUnresolvedImagesFailed(prev)
    expect(next.get("a")?.status).toBe("failed")
    expect(next.get("a")?.url).toBeNull()
    expect(next.get("b")?.status).toBe("failed")
    // 已就绪的不动
    expect(next.get("c")?.status).toBe("ready")
    expect(next.get("c")?.url).toBe("/c.png")
  })

  it("returns the SAME reference when nothing is unresolved (no needless rerender)", () => {
    const prev = new Map<string, StreamingImage>([
      ["a", mk("ready", "/a.png")],
      ["b", mk("failed")],
    ])
    expect(markUnresolvedImagesFailed(prev)).toBe(prev)
  })

  it("does not mutate prev when it does change", () => {
    const prev = new Map<string, StreamingImage>([["a", mk("pending")]])
    const next = markUnresolvedImagesFailed(prev)
    expect(next).not.toBe(prev)
    expect(prev.get("a")?.status).toBe("pending")
  })
})
