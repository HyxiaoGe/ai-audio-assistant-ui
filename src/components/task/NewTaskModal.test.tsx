import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import NewTaskModal from "./NewTaskModal"

const mockClient = vi.hoisted(() => ({
  getLLMModels: vi.fn(),
  getSummaryStyles: vi.fn(),
  getUserPreferences: vi.fn(),
  getYouTubeSummaryStyleRecommendation: vi.fn(),
  createTask: vi.fn(),
}))

vi.mock("@/lib/use-api-client", () => ({
  useAPIClient: () => mockClient,
}))

// 提升为 hoisted,使上传 tab 提交时透传给 uploadFile 的 options 可被断言
const uploadMock = vi.hoisted(() => ({ uploadFile: vi.fn() }))
vi.mock("@/hooks/use-file-upload", () => ({
  useFileUpload: () => ({
    state: { progress: 0 },
    uploadFile: uploadMock.uploadFile,
    reset: vi.fn(),
    isUploading: false,
  }),
}))

// 隔离上传 UI:暴露一个按钮,点击即用一个假 File 触发 onFileSelect,使 selectedFile 就绪可提交。
vi.mock("./UploadZone", () => ({
  default: (props: { onFileSelect: (file: File) => void }) => (
    <button
      type="button"
      data-testid="pick-file"
      onClick={() => props.onFileSelect(new File(["x"], "a.mp3", { type: "audio/mpeg" }))}
    >
      pick
    </button>
  ),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("@/lib/notify", () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}))

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({
    locale: "en",
    t: (key: string, vars?: Record<string, string | number>) =>
      vars?.platform ? `${key}:${vars.platform}` : key,
  }),
}))

describe("NewTaskModal auto-detect summary style", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClient.getLLMModels.mockResolvedValue({ models: [] })
    mockClient.getSummaryStyles.mockResolvedValue({
      styles: [
        { id: "auto", name: "Auto-detect", description: "Auto", focus: "AI picks the best style", icon: "sparkles" },
        { id: "meeting", name: "Meeting", description: "Meeting", focus: "Decisions", icon: "users" },
        { id: "tutorial", name: "Tutorial", description: "Tutorial", focus: "Steps", icon: "play-circle" },
      ],
    })
    mockClient.getUserPreferences.mockResolvedValue({ task_defaults: {} })
  })

  it("defaults the summary style select to the backend auto item", async () => {
    render(<NewTaskModal isOpen onClose={vi.fn()} />)
    await screen.findByRole("dialog")

    const select = (await screen.findByLabelText(/newTask\.summaryStyle/)) as HTMLSelectElement
    await waitFor(() => expect(select.value).toBe("auto"))
    expect(screen.getByDisplayValue("Auto-detect")).toBeInTheDocument()
  })

  it("submits summary_style 'auto' from the upload tab when the user does not change the style", async () => {
    render(<NewTaskModal isOpen onClose={vi.fn()} />)
    await screen.findByRole("dialog")
    await screen.findByDisplayValue("Auto-detect")

    fireEvent.click(screen.getByTestId("pick-file"))
    fireEvent.click(screen.getByRole("button", { name: /newTask\.startProcessing/ }))

    await waitFor(() => expect(uploadMock.uploadFile).toHaveBeenCalled())
    const passedOptions = uploadMock.uploadFile.mock.calls[0][1]
    expect(passedOptions.summary_style).toBe("auto")
  })
})

describe("NewTaskModal YouTube style recommendation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClient.getLLMModels.mockResolvedValue({ models: [] })
    mockClient.getSummaryStyles.mockResolvedValue({
      styles: [
        { id: "general", name: "General", description: "General", focus: "Key points", icon: "file-text" },
        { id: "tutorial", name: "Tutorial", description: "Tutorial", focus: "Steps", icon: "play-circle" },
      ],
    })
    mockClient.getUserPreferences.mockResolvedValue({
      task_defaults: { summary_style: "general" },
    })
    mockClient.getYouTubeSummaryStyleRecommendation.mockResolvedValue({
      style: "tutorial",
      confidence: 0.84,
      reason: "The title or description has tutorial and step-by-step signals.",
      cached: false,
    })
  })

  it("loads a recommendation for an initial YouTube URL and applies it as the default style", async () => {
    render(
      <NewTaskModal
        isOpen
        onClose={vi.fn()}
        initialVideoUrl="https://www.youtube.com/watch?v=yt-123"
      />
    )

    await waitFor(() => {
      expect(mockClient.getYouTubeSummaryStyleRecommendation).toHaveBeenCalledWith("yt-123")
    })

    expect(await screen.findByDisplayValue("Tutorial")).toBeInTheDocument()
    expect(screen.getByText(/step-by-step signals/i)).toBeInTheDocument()
  })

  it("loads a recommendation when a mounted modal is opened with a subscription video URL", async () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <NewTaskModal
        isOpen={false}
        onClose={onClose}
      />
    )

    rerender(
      <NewTaskModal
        isOpen
        onClose={onClose}
        initialVideoUrl="https://www.youtube.com/watch?v=url-video"
        initialYouTubeVideoId="subscription-video"
      />
    )

    await waitFor(() => {
      expect(mockClient.getYouTubeSummaryStyleRecommendation).toHaveBeenCalledWith("subscription-video")
    })
    expect(mockClient.getYouTubeSummaryStyleRecommendation).toHaveBeenCalledTimes(1)
  })

  it("keeps the recommended style when preferences load after the recommendation", async () => {
    let resolvePreferences!: (value: { task_defaults: { summary_style: string } }) => void
    mockClient.getUserPreferences.mockReturnValue(
      new Promise((resolve) => {
        resolvePreferences = resolve
      })
    )

    render(
      <NewTaskModal
        isOpen
        onClose={vi.fn()}
        initialVideoUrl="https://www.youtube.com/watch?v=yt-123"
      />
    )

    expect(await screen.findByDisplayValue("Tutorial")).toBeInTheDocument()

    await act(async () => {
      resolvePreferences({ task_defaults: { summary_style: "general" } })
    })

    expect(screen.getByDisplayValue("Tutorial")).toBeInTheDocument()
  })

  it("does not expose the retired visual summary controls", async () => {
    render(
      <NewTaskModal
        isOpen
        onClose={vi.fn()}
        initialVideoUrl="https://www.youtube.com/watch?v=yt-123"
      />
    )

    await screen.findByDisplayValue("Tutorial")

    expect(screen.queryByText("newTask.visualSummary")).not.toBeInTheDocument()
    expect(screen.queryByText("newTask.autoGenerateVisualSummary")).not.toBeInTheDocument()
    expect(screen.queryByText("newTask.visualTypes")).not.toBeInTheDocument()
  })
})

// audit #2：新建任务模态改用 Radix Dialog 后，必须是可访问的 dialog 且支持 Esc 关闭。
describe("NewTaskModal a11y (Radix Dialog)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClient.getLLMModels.mockResolvedValue({ models: [] })
    mockClient.getSummaryStyles.mockResolvedValue({ styles: [] })
    mockClient.getUserPreferences.mockResolvedValue({ task_defaults: {} })
  })

  it("renders an accessible dialog and closes on Escape", async () => {
    const onClose = vi.fn()
    render(<NewTaskModal isOpen onClose={onClose} />)

    const dialog = await screen.findByRole("dialog")
    expect(dialog).toHaveAccessibleName()

    fireEvent.keyDown(dialog, { key: "Escape" })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})

// audit a11y #8/#28/#36 #37/#38 #39：头部关闭 X 按钮无可访问名称；语言/摘要风格
// <select> 的可见 <label> 未通过 htmlFor/id 关联；说话人识别 checkbox 的无障碍
// 名称只有「启用」，缺少字段语境。
describe("NewTaskModal a11y (controls)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClient.getLLMModels.mockResolvedValue({ models: [] })
    mockClient.getSummaryStyles.mockResolvedValue({
      styles: [
        { id: "general", name: "General", description: "General", focus: "Key points", icon: "file-text" },
      ],
    })
    mockClient.getUserPreferences.mockResolvedValue({ task_defaults: {} })
  })

  it("exposes the header close button with an accessible name", async () => {
    const onClose = vi.fn()
    render(<NewTaskModal isOpen onClose={onClose} />)
    await screen.findByRole("dialog")

    const closeBtn = screen.getByRole("button", { name: "common.close" })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it("associates the language select with its visible label", async () => {
    render(<NewTaskModal isOpen onClose={vi.fn()} />)
    await screen.findByRole("dialog")

    const select = screen.getByLabelText(/newTask\.language/)
    expect(select.tagName).toBe("SELECT")
  })

  it("associates the summary-style select with its visible label", async () => {
    render(<NewTaskModal isOpen onClose={vi.fn()} />)
    await screen.findByRole("dialog")

    const select = screen.getByLabelText(/newTask\.summaryStyle/)
    expect(select.tagName).toBe("SELECT")
  })

  it("names the speaker-diarization checkbox with its field context", async () => {
    render(<NewTaskModal isOpen onClose={vi.fn()} />)
    await screen.findByRole("dialog")

    const checkbox = screen.getByRole("checkbox", {
      name: /newTask\.speakerDiarization/,
    })
    expect(checkbox).toBeInTheDocument()
  })

  // audit a11y F179：标签内容区需标注为 tabpanel 并经 aria-labelledby 关联当前标签。
  it("marks the active tab content as a labelled tabpanel", async () => {
    render(<NewTaskModal isOpen onClose={vi.fn()} />)
    await screen.findByRole("dialog")

    const panel = screen.getByRole("tabpanel")
    expect(panel).toHaveAttribute("id", "tabpanel-upload")
    expect(panel).toHaveAttribute("aria-labelledby", "tab-upload")
  })
})
