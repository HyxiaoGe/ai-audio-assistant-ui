import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { VisualSummaryView } from "./VisualSummaryView"
import type { SummaryItem } from "@/types/api"

const mockClient = vi.hoisted(() => ({
  getVisualSummary: vi.fn(),
}))

vi.mock("@/lib/use-api-client", () => ({
  useAPIClient: () => mockClient,
}))

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: "<svg></svg>" }),
  },
}))

function visualSummary(overrides: Partial<SummaryItem> = {}): SummaryItem {
  return {
    id: "summary-1",
    summary_type: "visual_mindmap",
    version: 1,
    is_active: true,
    content: "graph TD; A-->B",
    model_used: "test-model",
    prompt_version: null,
    token_count: null,
    created_at: "2026-05-23T00:00:00Z",
    visual_format: "mermaid",
    image_url: "https://media.example.com/visuals/task/mindmap.png?signature=download",
    image_model_used: null,
    ...overrides,
  }
}

describe("VisualSummaryView media URL contract", () => {
  it("renders the backend-provided image_url directly", async () => {
    render(
      <VisualSummaryView
        taskId="task-1"
        visualType="mindmap"
        renderMode="image"
        initialData={visualSummary()}
      />
    )

    const image = await screen.findByRole("img")

    expect(image).toHaveAttribute(
      "src",
      "https://media.example.com/visuals/task/mindmap.png?signature=download"
    )
  })

  it("downloads the backend-provided image_url directly", async () => {
    const originalCreateElement = document.createElement.bind(document)
    let createdAnchor: HTMLAnchorElement | null = null
    const click = vi.fn()

    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName)
      if (tagName === "a") {
        createdAnchor = element as HTMLAnchorElement
        Object.defineProperty(element, "click", { value: click })
      }
      return element
    })

    render(
      <VisualSummaryView
        taskId="task-1"
        visualType="mindmap"
        renderMode="image"
        initialData={visualSummary()}
      />
    )

    await screen.findByRole("img")

    fireEvent.click(screen.getByRole("button", { name: "下载图片" }))

    // createdAnchor 只在 spy 回调里被赋值，TS 的控制流会把它收窄成 never；
    // 经显式类型的局部变量读取以恢复正确类型。
    const downloadAnchor = createdAnchor as HTMLAnchorElement | null
    expect(downloadAnchor?.href).toBe("https://media.example.com/visuals/task/mindmap.png?signature=download")
    expect(click).toHaveBeenCalledOnce()
  })
})
