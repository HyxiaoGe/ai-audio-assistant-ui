import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockClient = vi.hoisted(() => ({
  getYouTubeBlocklist: vi.fn(),
  addYouTubeBlocklistEntry: vi.fn(),
  deleteYouTubeBlocklistEntry: vi.fn(),
}))
const mockNotify = vi.hoisted(() => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
  notifyInfo: vi.fn(),
  notifyWarning: vi.fn(),
}))

vi.mock("@/lib/use-api-client", () => ({ useAPIClient: () => mockClient }))
vi.mock("@/lib/i18n-context", () => ({ useI18n: () => ({ t: (k: string) => k }) }))
vi.mock("@/lib/notify", () => mockNotify)

import YouTubeBlocklistPanel from "./YouTubeBlocklistPanel"

const channelEntry = {
  id: "c9",
  kind: "channel",
  match_field: "channel_name",
  raw_value: "Lex Fridman",
  note: null,
  created_at: "2026-06-26T00:00:00Z",
}

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

  it("输入搜索词点添加 → 调 api(kind=term)+成功 toast", async () => {
    render(<YouTubeBlocklistPanel />)
    const input = screen.getByPlaceholderText("admin.blocklist.termPlaceholder")
    fireEvent.change(input, { target: { value: "bad word" } })
    const addButtons = screen.getAllByText("admin.blocklist.add")
    fireEvent.click(addButtons[0]) // 第一个区块=搜索词
    await waitFor(() =>
      expect(mockClient.addYouTubeBlocklistEntry).toHaveBeenCalledWith({ kind: "term", value: "bad word" })
    )
    await waitFor(() => expect(mockNotify.notifySuccess).toHaveBeenCalledWith("admin.blocklist.addSuccess"))
  })

  it("回车提交搜索词 → 调 api(kind=term)", async () => {
    render(<YouTubeBlocklistPanel />)
    const input = screen.getByPlaceholderText("admin.blocklist.termPlaceholder")
    fireEvent.change(input, { target: { value: "via enter" } })
    fireEvent.submit(input)
    await waitFor(() =>
      expect(mockClient.addYouTubeBlocklistEntry).toHaveBeenCalledWith({ kind: "term", value: "via enter" })
    )
  })

  it("添加失败 → toast 错误(后端消息)", async () => {
    mockClient.addYouTubeBlocklistEntry.mockRejectedValueOnce(new Error("配额超限"))
    render(<YouTubeBlocklistPanel />)
    const input = screen.getByPlaceholderText("admin.blocklist.termPlaceholder")
    fireEvent.change(input, { target: { value: "bad word" } })
    fireEvent.click(screen.getAllByText("admin.blocklist.add")[0])
    await waitFor(() => expect(mockNotify.notifyError).toHaveBeenCalledWith("配额超限"))
  })

  it("输入为空时添加按钮禁用", () => {
    render(<YouTubeBlocklistPanel />)
    for (const btn of screen.getAllByText("admin.blocklist.add")) {
      expect((btn.closest("button") as HTMLButtonElement).disabled).toBe(true)
    }
  })

  it("频道条目展示匹配维度徽章", async () => {
    mockClient.getYouTubeBlocklist.mockResolvedValue({
      items: [{ ...channelEntry, id: "c1", match_field: "channel_id", raw_value: "https://youtube.com/@x" }],
    })
    render(<YouTubeBlocklistPanel />)
    await screen.findByText("admin.blocklist.matchChannelId")
  })

  it("点删除先弹确认框,不立即调 api;确认后才删除", async () => {
    mockClient.getYouTubeBlocklist.mockResolvedValue({ items: [channelEntry] })
    render(<YouTubeBlocklistPanel />)
    await screen.findByText("Lex Fridman")
    fireEvent.click(screen.getByText("admin.blocklist.remove"))
    await screen.findByText("admin.blocklist.removeConfirmTitle")
    expect(mockClient.deleteYouTubeBlocklistEntry).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText("common.delete"))
    await waitFor(() => expect(mockClient.deleteYouTubeBlocklistEntry).toHaveBeenCalledWith("c9"))
    await waitFor(() => expect(mockNotify.notifySuccess).toHaveBeenCalledWith("admin.blocklist.removeSuccess"))
  })

  it("确认框取消 → 不调删除 api", async () => {
    mockClient.getYouTubeBlocklist.mockResolvedValue({ items: [channelEntry] })
    render(<YouTubeBlocklistPanel />)
    await screen.findByText("Lex Fridman")
    fireEvent.click(screen.getByText("admin.blocklist.remove"))
    await screen.findByText("admin.blocklist.removeConfirmTitle")
    fireEvent.click(screen.getByText("common.cancel"))
    await waitFor(() => expect(screen.queryByText("admin.blocklist.removeConfirmTitle")).toBeNull())
    expect(mockClient.deleteYouTubeBlocklistEntry).not.toHaveBeenCalled()
  })
})
