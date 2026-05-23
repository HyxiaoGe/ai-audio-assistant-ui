import { render, screen, waitFor } from "@testing-library/react"
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
  })
})
