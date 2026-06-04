import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { UploadDialog } from "./UploadDialog"

const mockClient = vi.hoisted(() => ({
  getLLMModels: vi.fn(),
  getSummaryStyles: vi.fn(),
}))

vi.mock("@/lib/use-api-client", () => ({
  useAPIClient: () => mockClient,
}))

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({
    locale: "en",
    t: (key: string) => key,
  }),
}))

// 隔离上传逻辑：FileUploader 仅暴露它收到的 options.summary_style，便于断言透传默认值。
const capturedOptions = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }))
vi.mock("./FileUploader", () => ({
  FileUploader: (props: { options: Record<string, unknown> }) => {
    capturedOptions.current = props.options
    return <div data-testid="file-uploader" />
  },
}))

describe("UploadDialog auto-detect summary style", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedOptions.current = null
    mockClient.getLLMModels.mockResolvedValue({ models: [] })
    mockClient.getSummaryStyles.mockResolvedValue({
      styles: [
        { id: "auto", name: "Auto-detect", description: "Auto", focus: "AI picks the best style", icon: "sparkles" },
        { id: "meeting", name: "Meeting", description: "Meeting", focus: "Decisions", icon: "users" },
      ],
    })
  })

  it("defaults summary_style to 'auto' and passes it through to FileUploader", async () => {
    render(<UploadDialog open onOpenChange={vi.fn()} />)

    // 主断言（稳）：默认 options.summary_style 透传为 auto
    await waitFor(() => expect(capturedOptions.current?.summary_style).toBe("auto"))
    // file-uploader 挂载确认
    expect(screen.getByTestId("file-uploader")).toBeInTheDocument()
  })
})
