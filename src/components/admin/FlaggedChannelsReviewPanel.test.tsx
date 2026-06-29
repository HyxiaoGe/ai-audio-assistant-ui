import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError } from "@/types/api"

const mockClient = vi.hoisted(() => ({
  getFlaggedChannels: vi.fn(),
  resolveFlaggedChannel: vi.fn(),
  batchResolveFlaggedChannels: vi.fn(),
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
vi.mock("@/lib/use-date-formatter", () => ({
  useDateFormatter: () => ({ formatDateTime: (s: string) => s }),
}))

import FlaggedChannelsReviewPanel from "./FlaggedChannelsReviewPanel"

const flag = (over: Record<string, unknown> = {}) => ({
  id: "f1",
  match_field: "channel_id",
  match_value: "UCabc",
  channel_id: "UCabc",
  channel_handle: null,
  channel_name: "Evil Channel",
  block_count: 12,
  last_video_id: "vid123",
  last_title: "坏视频标题",
  status: "pending",
  first_flagged_at: "2026-06-27T00:00:00Z",
  last_flagged_at: "2026-06-27T10:00:00Z",
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  mockClient.getFlaggedChannels.mockResolvedValue({ items: [] })
  mockClient.resolveFlaggedChannel.mockResolvedValue(flag({ status: "blocked" }))
  mockClient.batchResolveFlaggedChannels.mockResolvedValue({ resolved_count: 0, items: [] })
})
afterEach(() => { vi.restoreAllMocks() })

describe("FlaggedChannelsReviewPanel", () => {
  it("加载 → 渲染卡片(身份+命中徽章)", async () => {
    mockClient.getFlaggedChannels.mockResolvedValue({ items: [flag()] })
    render(<FlaggedChannelsReviewPanel />)
    await screen.findByText("Evil Channel")
    expect(screen.getAllByText("admin.flaggedChannels.hits").length).toBeGreaterThan(0)
    expect(mockClient.getFlaggedChannels).toHaveBeenCalled()
  })

  it("空列表 → EmptyState", async () => {
    render(<FlaggedChannelsReviewPanel />)
    await screen.findByText("admin.flaggedChannels.emptyTitle")
  })

  it("拉黑流:点拉黑→弹窗→填备注→确认 → resolve(block+note)+reload+成功 toast", async () => {
    mockClient.getFlaggedChannels.mockResolvedValue({ items: [flag()] })
    render(<FlaggedChannelsReviewPanel />)
    await screen.findByText("Evil Channel")
    fireEvent.click(screen.getByText("admin.flaggedChannels.block"))
    await screen.findByText("admin.flaggedChannels.blockConfirmTitle")
    fireEvent.change(screen.getByPlaceholderText("admin.flaggedChannels.notePlaceholder"), {
      target: { value: "确有违规" },
    })
    expect(mockClient.resolveFlaggedChannel).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText("admin.flaggedChannels.blockCta"))
    await waitFor(() =>
      expect(mockClient.resolveFlaggedChannel).toHaveBeenCalledWith("f1", { action: "block", note: "确有违规" })
    )
    await waitFor(() => expect(mockClient.getFlaggedChannels).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(mockNotify.notifySuccess).toHaveBeenCalledWith("admin.flaggedChannels.blockSuccess"))
  })

  it("加白流:点加白→确认 → resolve(dismiss, note undefined)+reload", async () => {
    mockClient.getFlaggedChannels.mockResolvedValue({ items: [flag()] })
    render(<FlaggedChannelsReviewPanel />)
    await screen.findByText("Evil Channel")
    fireEvent.click(screen.getByText("admin.flaggedChannels.dismiss"))
    await screen.findByText("admin.flaggedChannels.dismissConfirmTitle")
    fireEvent.click(screen.getByText("admin.flaggedChannels.dismissCta"))
    await waitFor(() =>
      expect(mockClient.resolveFlaggedChannel).toHaveBeenCalledWith("f1", { action: "dismiss", note: undefined })
    )
  })

  it("resolve 遇 40906 → notifyInfo + 关弹窗 + reload(不报 error)", async () => {
    mockClient.getFlaggedChannels.mockResolvedValue({ items: [flag()] })
    mockClient.resolveFlaggedChannel.mockRejectedValueOnce(new ApiError(40906, "该频道标记已被复核处理", "t-1"))
    render(<FlaggedChannelsReviewPanel />)
    await screen.findByText("Evil Channel")
    fireEvent.click(screen.getByText("admin.flaggedChannels.dismiss"))
    await screen.findByText("admin.flaggedChannels.dismissConfirmTitle")
    fireEvent.click(screen.getByText("admin.flaggedChannels.dismissCta"))
    await waitFor(() => expect(mockNotify.notifyInfo).toHaveBeenCalledWith("该频道标记已被复核处理"))
    await waitFor(() => expect(screen.queryByText("admin.flaggedChannels.dismissConfirmTitle")).toBeNull())
    expect(mockNotify.notifyError).not.toHaveBeenCalled()
  })

  it("列表 40300 → forbidden 内联态(无卡片)", async () => {
    mockClient.getFlaggedChannels.mockRejectedValueOnce(new ApiError(40300, "无权限", "t-1"))
    render(<FlaggedChannelsReviewPanel />)
    await screen.findByText("admin.flaggedChannels.forbidden")
    expect(screen.queryByText("Evil Channel")).toBeNull()
  })

  const makeFlags = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      flag({ id: `f${i}`, channel_id: `UC${i}`, channel_name: `频道${i}` })
    )

  it("分页每页 8 条,下一页显示其余", async () => {
    mockClient.getFlaggedChannels.mockResolvedValue({ items: makeFlags(10) })
    render(<FlaggedChannelsReviewPanel />)
    expect(await screen.findByText("频道0")).toBeTruthy()
    expect(screen.queryByText("频道8")).toBeNull() // 第 9 条在第二页
    fireEvent.click(screen.getByText("common.nextPage"))
    expect(await screen.findByText("频道8")).toBeTruthy()
    expect(screen.queryByText("频道0")).toBeNull()
  })

  it("≤8 条不显示分页条", async () => {
    mockClient.getFlaggedChannels.mockResolvedValue({ items: makeFlags(8) })
    render(<FlaggedChannelsReviewPanel />)
    await screen.findByText("频道0")
    expect(screen.queryByText("common.nextPage")).toBeNull()
  })

  it("处置进行中 → 行内按钮禁用(busy-lock)", async () => {
    mockClient.getFlaggedChannels.mockResolvedValue({ items: [flag()] })
    let release: (v: unknown) => void = () => {}
    mockClient.resolveFlaggedChannel.mockReturnValueOnce(new Promise((r) => { release = r }))
    render(<FlaggedChannelsReviewPanel />)
    await screen.findByText("Evil Channel")
    fireEvent.click(screen.getByText("admin.flaggedChannels.dismiss"))
    await screen.findByText("admin.flaggedChannels.dismissConfirmTitle")
    fireEvent.click(screen.getByText("admin.flaggedChannels.dismissCta"))
    await waitFor(() => {
      const blockBtn = screen.getByText("admin.flaggedChannels.block").closest("button") as HTMLButtonElement
      expect(blockBtn.disabled).toBe(true)
    })
    release(flag({ status: "dismissed" }))
  })

  const threeFlags = [
    flag({ id: "f1", channel_name: "Alpha" }),
    flag({ id: "f2", channel_name: "Beta" }),
    flag({ id: "f3", channel_name: "Gamma" }),
  ]

  it("勾选 → 顶部条显已选 + 批量拉黑启用", async () => {
    mockClient.getFlaggedChannels.mockResolvedValue({ items: threeFlags })
    render(<FlaggedChannelsReviewPanel />)
    await screen.findByText("Alpha")
    // 行 checkbox(aria-label 含身份名);全选 checkbox 用 selectAll label
    const rowChecks = screen.getAllByRole("checkbox", { name: /selectOne|Alpha|Beta|Gamma/ })
    fireEvent.click(rowChecks[0])
    const batchBtn = screen.getByText("admin.flaggedChannels.batchBlock")
    expect(batchBtn.closest("button")).not.toBeDisabled()
  })

  it("批量拉黑全流程 → 调 batchResolve(block) + 成功 toast(全成) + reload", async () => {
    mockClient.getFlaggedChannels.mockResolvedValue({ items: threeFlags })
    mockClient.batchResolveFlaggedChannels.mockResolvedValue({
      resolved_count: 2,
      items: [
        { flag_id: "f1", status: "succeeded" },
        { flag_id: "f2", status: "skipped" },
      ],
    })
    render(<FlaggedChannelsReviewPanel />)
    await screen.findByText("Alpha")
    fireEvent.click(screen.getByText("admin.flaggedChannels.selectAll"))
    fireEvent.click(screen.getByText("admin.flaggedChannels.batchBlock"))
    await screen.findByText("admin.flaggedChannels.batchConfirmTitle")
    fireEvent.click(screen.getByText("admin.flaggedChannels.batchBlockCta"))
    await waitFor(() =>
      expect(mockClient.batchResolveFlaggedChannels).toHaveBeenCalledWith({
        flag_ids: ["f1", "f2", "f3"],
        action: "block",
        note: undefined,
      })
    )
    await waitFor(() => expect(mockClient.getFlaggedChannels).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(mockNotify.notifySuccess).toHaveBeenCalledWith("admin.flaggedChannels.batchSuccess")
    )
  })

  it("批量含 failed → batchPartial(error)提示", async () => {
    mockClient.getFlaggedChannels.mockResolvedValue({ items: threeFlags })
    mockClient.batchResolveFlaggedChannels.mockResolvedValue({
      resolved_count: 1,
      items: [
        { flag_id: "f1", status: "succeeded" },
        { flag_id: "f2", status: "failed", code: 40906 },
      ],
    })
    render(<FlaggedChannelsReviewPanel />)
    await screen.findByText("Alpha")
    fireEvent.click(screen.getByText("admin.flaggedChannels.selectAll"))
    fireEvent.click(screen.getByText("admin.flaggedChannels.batchBlock"))
    await screen.findByText("admin.flaggedChannels.batchConfirmTitle")
    fireEvent.click(screen.getByText("admin.flaggedChannels.batchBlockCta"))
    await waitFor(() =>
      expect(mockNotify.notifyError).toHaveBeenCalledWith("admin.flaggedChannels.batchPartial")
    )
  })

  it("清除 → 选择集清空,批量拉黑禁用", async () => {
    mockClient.getFlaggedChannels.mockResolvedValue({ items: threeFlags })
    render(<FlaggedChannelsReviewPanel />)
    await screen.findByText("Alpha")
    fireEvent.click(screen.getByText("admin.flaggedChannels.selectAll"))
    fireEvent.click(screen.getByText("admin.flaggedChannels.clearSelection"))
    expect(screen.getByText("admin.flaggedChannels.batchBlock").closest("button")).toBeDisabled()
  })
})
