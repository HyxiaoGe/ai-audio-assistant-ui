import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockClient = vi.hoisted(() => ({
  getYouTubeBlocklist: vi.fn(),
  addYouTubeBlocklistEntry: vi.fn(),
  deleteYouTubeBlocklistEntry: vi.fn(),
}))

vi.mock("@/lib/use-api-client", () => ({ useAPIClient: () => mockClient }))
vi.mock("@/lib/i18n-context", () => ({ useI18n: () => ({ t: (k: string) => k }) }))

import YouTubeBlocklistPanel from "./YouTubeBlocklistPanel"

beforeEach(() => {
  vi.clearAllMocks()
  mockClient.getYouTubeBlocklist.mockResolvedValue({ items: [] })
  mockClient.addYouTubeBlocklistEntry.mockResolvedValue({
    id: "e1", kind: "term", match_field: "query", raw_value: "bad", note: null, created_at: "2026-06-26T00:00:00Z",
  })
  mockClient.deleteYouTubeBlocklistEntry.mockResolvedValue(undefined)
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe("YouTubeBlocklistPanel", () => {
  it("渲染两区块标题并加载列表", async () => {
    render(<YouTubeBlocklistPanel />)
    expect(screen.getByText("admin.blocklist.termsTitle")).toBeTruthy()
    expect(screen.getByText("admin.blocklist.channelsTitle")).toBeTruthy()
    await waitFor(() => expect(mockClient.getYouTubeBlocklist).toHaveBeenCalled())
  })

  it("输入搜索词点添加 → 调 api(kind=term)", async () => {
    render(<YouTubeBlocklistPanel />)
    const input = screen.getByPlaceholderText("admin.blocklist.termPlaceholder")
    fireEvent.change(input, { target: { value: "bad word" } })
    const addButtons = screen.getAllByText("admin.blocklist.add")
    fireEvent.click(addButtons[0]) // 第一个区块=搜索词
    await waitFor(() =>
      expect(mockClient.addYouTubeBlocklistEntry).toHaveBeenCalledWith({ kind: "term", value: "bad word" })
    )
  })

  it("点条目删除 → 调 api(id)", async () => {
    mockClient.getYouTubeBlocklist.mockResolvedValue({
      items: [
        { id: "c9", kind: "channel", match_field: "channel_name", raw_value: "Lex Fridman", note: null, created_at: "2026-06-26T00:00:00Z" },
      ],
    })
    render(<YouTubeBlocklistPanel />)
    await screen.findByText("Lex Fridman")
    fireEvent.click(screen.getByText("admin.blocklist.remove"))
    await waitFor(() => expect(mockClient.deleteYouTubeBlocklistEntry).toHaveBeenCalledWith("c9"))
  })
})
