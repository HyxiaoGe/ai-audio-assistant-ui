import { describe, it, expect, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  fetchPublicTaskDetail: vi.fn(),
  fetchPublicSummary: vi.fn(),
}))
vi.mock("@/lib/server-api", () => ({
  fetchPublicTaskDetail: mocks.fetchPublicTaskDetail,
  fetchPublicSummary: mocks.fetchPublicSummary,
}))
vi.mock("./page-client", () => ({ default: () => null }))

import { generateMetadata } from "./page"

const params = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.fetchPublicSummary.mockResolvedValue(undefined)
})

describe("explore/[id] generateMetadata", () => {
  it("not_found → noindex(内容撤回/非公开)", async () => {
    mocks.fetchPublicTaskDetail.mockResolvedValue({ status: "not_found" })
    const meta = await generateMetadata(params("x"))
    expect(meta.robots).toEqual({ index: false, follow: false })
    expect(meta.alternates?.canonical).toBeUndefined()
  })

  it("unavailable(临时预取失败)→ 通用 metadata,不 noindex", async () => {
    mocks.fetchPublicTaskDetail.mockResolvedValue({ status: "unavailable" })
    const meta = await generateMetadata(params("x"))
    expect(meta.robots).toBeUndefined() // 不能 noindex 一个正常公开但临时取数失败的页
    expect(meta.alternates?.canonical).toBeUndefined() // 无 task 数据,无 canonical
  })

  it("ok → canonical 指回原视频 + 标题/描述", async () => {
    mocks.fetchPublicTaskDetail.mockResolvedValue({
      status: "ok",
      data: { title: "标题", source_url: "https://youtu.be/abc" },
    })
    mocks.fetchPublicSummary.mockResolvedValue({ items: [{ content: "# 摘要\n正文" }] })
    const meta = await generateMetadata(params("x"))
    expect(meta.robots).toBeUndefined()
    expect(meta.alternates?.canonical).toBe("https://youtu.be/abc")
    expect(typeof meta.title).toBe("string")
  })
})
