import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { SearchSnippet } from "./SearchSnippet"

// 后端 ts_headline 返回的片段把命中词包在字面 <mark>…</mark> 里，其余是转写正文（用户可影响，
// 可能含 <、>、<script> 等）。锁定：高亮渲染成真正的 <mark> 元素，但正文一律当纯文本（React
// 自动转义）——绝不 dangerouslySetInnerHTML，杜绝 XSS。
describe("SearchSnippet", () => {
  it("renders the marked term inside a <mark> element", () => {
    const { container } = render(<SearchSnippet text="这期聊到<mark>谷歌</mark>的新模型" />)
    const mark = container.querySelector("mark")
    expect(mark).not.toBeNull()
    expect(mark?.textContent).toBe("谷歌")
  })

  it("renders the surrounding transcript text around the highlight", () => {
    const { container } = render(<SearchSnippet text="这期聊到<mark>谷歌</mark>的新模型" />)
    expect(container.textContent).toBe("这期聊到谷歌的新模型")
  })

  it("treats angle-bracket content as literal text (no HTML injection)", () => {
    const { container } = render(
      <SearchSnippet text="他说 <script>alert(1)</script> 然后提到<mark>谷歌</mark>" />
    )
    // <script> 必须作为可见文本存在，且没有真的 <script> 元素被注入
    expect(container.textContent).toContain("<script>alert(1)</script>")
    expect(container.querySelector("script")).toBeNull()
  })

  it("renders a snippet with no marks as plain text", () => {
    render(<SearchSnippet text="没有任何高亮的片段" />)
    expect(screen.getByText("没有任何高亮的片段")).toBeInTheDocument()
  })
})
