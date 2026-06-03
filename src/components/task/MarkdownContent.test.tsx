import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MarkdownContent } from "./MarkdownContent"
import type { StreamingImage } from "@/types/api"

// MarkdownContent 是从 TaskDetail 抽出的摘要 Markdown 渲染器（audit #8 拆分第 2 步）。
// 这些用例锁定既有渲染行为：标题/段落、GFM 复选框只读、图片占位符 {{IMAGE:..}}、
// 媒体 token 注入、图注里的生成模型。先红后绿，迁移时不得改变行为。

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({
    locale: "en",
    t: (key: string, vars?: Record<string, string | number>) =>
      vars?.model !== undefined ? `${key}:${vars.model}` : key,
  }),
}))

const noImages = new Map<string, StreamingImage>()

describe("MarkdownContent", () => {
  it("renders markdown headings and paragraphs", () => {
    render(
      <MarkdownContent content={"# Title\n\nHello world"} streamingImages={noImages} mediaToken={null} />
    )
    expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument()
    expect(screen.getByText("Hello world")).toBeInTheDocument()
  })

  it("renders GFM task-list items as read-only checkboxes", () => {
    render(
      <MarkdownContent content={"- [x] done\n- [ ] todo"} streamingImages={noImages} mediaToken={null} />
    )
    const boxes = screen.getAllByRole("checkbox")
    expect(boxes).toHaveLength(2)
    expect(boxes[0]).toBeChecked()
    expect(boxes[0]).toHaveAttribute("readonly")
  })

  it("renders an ImagePlaceholder for an {{IMAGE: ...}} paragraph instead of a <p>", () => {
    render(
      <MarkdownContent content={"{{IMAGE: 时间轴}}"} streamingImages={noImages} mediaToken={null} />
    )
    expect(screen.getByText("时间轴")).toBeInTheDocument()
    expect(screen.getByText("正在生成图片...")).toBeInTheDocument()
  })

  it("appends the media token to proxy image URLs and shows the model in the caption", () => {
    render(
      <MarkdownContent
        content={"![diagram](/api/v1/summaries/images/x.png)"}
        streamingImages={noImages}
        mediaToken={"tok123"}
        imageModel={"gpt-image-1"}
      />
    )
    const img = screen.getByRole("img", { name: "diagram" })
    expect(img).toHaveAttribute("src", "/api/v1/summaries/images/x.png?token=tok123")

    const caption = img.closest("figure")?.querySelector("figcaption")
    expect(caption?.textContent).toContain("diagram")
    expect(caption?.textContent).toContain("summary.imageGeneratedBy:")
  })

  it("renders a READY ImagePlaceholder image when streamingImages carries a ready url", () => {
    const images = new Map<string, StreamingImage>([
      [
        "{{IMAGE: 时间轴}}",
        { placeholder: "{{IMAGE: 时间轴}}", description: "时间轴", url: "/api/v1/summaries/images/t.png", status: "ready" },
      ],
    ])
    render(
      <MarkdownContent content={"{{IMAGE: 时间轴}}"} streamingImages={images} mediaToken={"tok"} />
    )
    const img = screen.getByRole("img", { name: "时间轴" })
    // ImagePlaceholder 的 ready 分支直出 imageUrl（已被 appendMediaToken 注入 token）
    expect(img).toHaveAttribute("src", "/api/v1/summaries/images/t.png?token=tok")
  })

  it("renders the FAILED fallback when streamingImages marks the placeholder failed", () => {
    const images = new Map<string, StreamingImage>([
      [
        "{{IMAGE: 流程图}}",
        { placeholder: "{{IMAGE: 流程图}}", description: "流程图", url: null, status: "failed" },
      ],
    ])
    render(
      <MarkdownContent content={"{{IMAGE: 流程图}}"} streamingImages={images} mediaToken={null} />
    )
    expect(screen.getByText("[图片：流程图]")).toBeInTheDocument()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

  it("still renders legacy inline ![](url) images directly via the img override (old data)", () => {
    render(
      <MarkdownContent
        content={"![老图](/api/v1/summaries/images/legacy.png)"}
        streamingImages={noImages}
        mediaToken={"tok"}
      />
    )
    const img = screen.getByRole("img", { name: "老图" })
    expect(img).toHaveAttribute("src", "/api/v1/summaries/images/legacy.png?token=tok")
  })
})
