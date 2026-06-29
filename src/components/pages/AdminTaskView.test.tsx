import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockClient = vi.hoisted(() => ({
  getAdminTaskDetail: vi.fn(),
  getAdminTaskTranscript: vi.fn(),
  getAdminTaskSummary: vi.fn(),
}))
vi.mock("@/lib/use-api-client", () => ({ useAPIClient: () => mockClient }))
vi.mock("@/lib/i18n-context", () => ({ useI18n: () => ({ t: (k: string) => k }) }))
vi.mock("next/navigation", () => ({ useParams: () => ({ tid: "task-1" }) }))
vi.mock("@/lib/use-date-formatter", () => ({ useDateFormatter: () => ({ formatDateTime: (v: string) => v }) }))
// 重子组件桩:断言 readOnly 透传,避免拉入 audio-store / markdown 链路
vi.mock("@/components/task/TranscriptList", () => ({
  TranscriptList: (props: { readOnly?: boolean; transcript: unknown[] }) => (
    <div data-testid="transcript-list" data-readonly={String(props.readOnly)}>
      segs:{props.transcript.length}
    </div>
  ),
}))
vi.mock("@/components/task/MarkdownContent", () => ({
  MarkdownContent: (props: { content: string }) => <div data-testid="markdown">{props.content}</div>,
}))

import AdminTaskView from "./AdminTaskView"

beforeEach(() => {
  vi.clearAllMocks()
  mockClient.getAdminTaskDetail.mockResolvedValue({
    id: "task-1", title: "标题", source_type: "youtube", status: "failed",
    created_at: "2026-06-29T00:00:00Z", updated_at: "2026-06-29T00:00:00Z",
    error_message: "ASR 超时", audio_url: undefined,
  })
  mockClient.getAdminTaskTranscript.mockResolvedValue({
    task_id: "task-1", total: 1,
    items: [{ sequence: 1, speaker_id: "0", speaker_label: null, content: "一段话", start_time: 0, end_time: 5 }],
  })
  mockClient.getAdminTaskSummary.mockResolvedValue({
    task_id: "task-1", total: 1,
    items: [{ summary_type: "overview", version: 1, content: "概览正文", image_url: null, images: null, created_at: "2026-06-29T00:00:00Z" }],
  })
})
afterEach(() => vi.restoreAllMocks())

describe("AdminTaskView", () => {
  it("只读渲染元数据 + 转写(readOnly) + 摘要文本,失败显错误原因", async () => {
    render(<AdminTaskView />)
    await waitFor(() => expect(screen.getByText("标题")).toBeInTheDocument())
    expect(screen.getByText("ASR 超时")).toBeInTheDocument()
    const tl = screen.getByTestId("transcript-list")
    expect(tl).toHaveAttribute("data-readonly", "true")
    expect(screen.getByTestId("markdown")).toHaveTextContent("概览正文")
  })

  it("无任何修改控件(删除/重生成/编辑)", async () => {
    render(<AdminTaskView />)
    await waitFor(() => expect(screen.getByText("标题")).toBeInTheDocument())
    expect(screen.queryByRole("button", { name: /delete|删除|regenerate|重新生成/i })).toBeNull()
  })
})
