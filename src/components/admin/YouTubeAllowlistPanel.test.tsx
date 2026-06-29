import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockClient = vi.hoisted(() => ({
  getYouTubeAllowlist: vi.fn(),
  addYouTubeAllowlistEntry: vi.fn(),
  deleteYouTubeAllowlistEntry: vi.fn(),
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

import YouTubeAllowlistPanel from "./YouTubeAllowlistPanel"

const channelEntry = {
  id: "a1",
  match_field: "channel_name",
  raw_value: "Kurzgesagt",
  normalized_value: "kurzgesagt",
  name: "Kurzgesagt",
  note: null,
  created_at: "2026-06-26T00:00:00Z",
}

beforeEach(() => {
  vi.clearAllMocks()
  mockClient.getYouTubeAllowlist.mockResolvedValue({ items: [] })
  mockClient.addYouTubeAllowlistEntry.mockResolvedValue({
    id: "a2", match_field: "channel_name", raw_value: "New Channel",
    normalized_value: "new channel", name: null, note: null, created_at: "2026-06-26T00:00:00Z",
  })
  mockClient.deleteYouTubeAllowlistEntry.mockResolvedValue(undefined)
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe("YouTubeAllowlistPanel", () => {
  it("初次渲染调 getYouTubeAllowlist 并渲染已放行频道(name 优先 raw_value)", async () => {
    mockClient.getYouTubeAllowlist.mockResolvedValue({ items: [channelEntry] })
    render(<YouTubeAllowlistPanel />)
    await waitFor(() => expect(mockClient.getYouTubeAllowlist).toHaveBeenCalled())
    expect(await screen.findByText("Kurzgesagt")).toBeTruthy()
  })

  it("name 为 null 时回落显示 raw_value", async () => {
    mockClient.getYouTubeAllowlist.mockResolvedValue({
      items: [{ ...channelEntry, id: "a3", name: null, raw_value: "UCraw123" }],
    })
    render(<YouTubeAllowlistPanel />)
    expect(await screen.findByText("UCraw123")).toBeTruthy()
  })

  it("输入无匹配频道名时添加按钮点亮 → 点击调 addYouTubeAllowlistEntry({ value }) → 重载", async () => {
    render(<YouTubeAllowlistPanel />)
    const input = screen.getByPlaceholderText("admin.allowlist.channelSearchOrAdd")
    fireEvent.change(input, { target: { value: "Brand New Channel" } })
    const addBtn = screen.getByText("admin.allowlist.add").closest("button") as HTMLButtonElement
    await waitFor(() => expect(addBtn.disabled).toBe(false))
    fireEvent.click(addBtn)
    await waitFor(() =>
      expect(mockClient.addYouTubeAllowlistEntry).toHaveBeenCalledWith({ value: "Brand New Channel" })
    )
    await waitFor(() => expect(mockClient.getYouTubeAllowlist).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(mockNotify.notifySuccess).toHaveBeenCalledWith("admin.allowlist.addSuccess"))
  })

  it("输入结构化命中已放行条目 → 显示「已在放行列表」提示且添加禁用", async () => {
    mockClient.getYouTubeAllowlist.mockResolvedValue({
      items: [{
        id: "h1", match_field: "channel_handle",
        raw_value: "https://youtube.com/@Kurzgesagt", name: "Kurzgesagt",
        normalized_value: "kurzgesagt", note: null, created_at: "2026-06-26T00:00:00Z",
      }],
    })
    render(<YouTubeAllowlistPanel />)
    await screen.findByText("Kurzgesagt")
    fireEvent.change(screen.getByPlaceholderText("admin.allowlist.channelSearchOrAdd"), {
      target: { value: "https://www.youtube.com/@Kurzgesagt" },
    })
    const addBtn = screen.getByText("admin.allowlist.add").closest("button") as HTMLButtonElement
    await waitFor(() => expect(addBtn.disabled).toBe(true))
    expect(screen.getByText("admin.allowlist.channelAlreadyAllowed")).toBeTruthy()
  })

  it("点删除弹确认 Dialog → 确认调 deleteYouTubeAllowlistEntry(id) → 重载", async () => {
    mockClient.getYouTubeAllowlist.mockResolvedValue({ items: [channelEntry] })
    render(<YouTubeAllowlistPanel />)
    await screen.findByText("Kurzgesagt")
    fireEvent.click(screen.getByText("admin.allowlist.remove"))
    await screen.findByText("admin.allowlist.removeConfirmTitle")
    expect(mockClient.deleteYouTubeAllowlistEntry).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText("common.delete"))
    await waitFor(() => expect(mockClient.deleteYouTubeAllowlistEntry).toHaveBeenCalledWith("a1"))
    await waitFor(() => expect(mockNotify.notifySuccess).toHaveBeenCalledWith("admin.allowlist.removeSuccess"))
    await waitFor(() => expect(mockClient.getYouTubeAllowlist).toHaveBeenCalledTimes(2))
  })

  it("getYouTubeAllowlist 拒绝时静默(不抛、不渲染错误)", async () => {
    mockClient.getYouTubeAllowlist.mockRejectedValue(new Error("Network error"))
    render(<YouTubeAllowlistPanel />)
    // wait a tick for the effect to complete
    await waitFor(() => expect(mockClient.getYouTubeAllowlist).toHaveBeenCalled())
    // No error UI rendered; section title should still appear
    expect(screen.getByText("admin.allowlist.channelsTitle")).toBeTruthy()
  })

  it("确认框取消 → 不调删除 api", async () => {
    mockClient.getYouTubeAllowlist.mockResolvedValue({ items: [channelEntry] })
    render(<YouTubeAllowlistPanel />)
    await screen.findByText("Kurzgesagt")
    fireEvent.click(screen.getByText("admin.allowlist.remove"))
    await screen.findByText("admin.allowlist.removeConfirmTitle")
    fireEvent.click(screen.getByText("common.cancel"))
    await waitFor(() => expect(screen.queryByText("admin.allowlist.removeConfirmTitle")).toBeNull())
    expect(mockClient.deleteYouTubeAllowlistEntry).not.toHaveBeenCalled()
  })

  it("有匹配时添加按钮禁用", async () => {
    mockClient.getYouTubeAllowlist.mockResolvedValue({ items: [channelEntry] })
    render(<YouTubeAllowlistPanel />)
    await screen.findByText("Kurzgesagt")
    fireEvent.change(screen.getByPlaceholderText("admin.allowlist.channelSearchOrAdd"), {
      target: { value: "Kurzgesagt" },
    })
    const addBtn = screen.getByText("admin.allowlist.add").closest("button") as HTMLButtonElement
    await waitFor(() => expect(addBtn.disabled).toBe(true))
  })

  it("无匹配时添加点亮", async () => {
    mockClient.getYouTubeAllowlist.mockResolvedValue({ items: [channelEntry] })
    render(<YouTubeAllowlistPanel />)
    await screen.findByText("Kurzgesagt")
    fireEvent.change(screen.getByPlaceholderText("admin.allowlist.channelSearchOrAdd"), {
      target: { value: "全新频道不在列表" },
    })
    const addBtn = screen.getByText("admin.allowlist.add").closest("button") as HTMLButtonElement
    await waitFor(() => expect(addBtn.disabled).toBe(false))
  })
})
