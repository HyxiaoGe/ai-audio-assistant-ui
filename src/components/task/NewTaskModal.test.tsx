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

vi.mock("@/hooks/use-file-upload", () => ({
  useFileUpload: () => ({
    state: { progress: 0 },
    uploadFile: vi.fn(),
    reset: vi.fn(),
    isUploading: false,
  }),
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
