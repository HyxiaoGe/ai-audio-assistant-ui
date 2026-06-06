import { describe, it, expect } from "vitest"
import { unwrapMarkdownFence } from "./markdown-fence"

// 偶发场景：LLM 把整段 Markdown 摘要正文包进 ```markdown ... ``` 代码围栏，后端原样落库。
// react-markdown 会把整段当成一个 fenced code block 渲染成等宽原文，{{IMAGE:..}} 占位符
// 永不进入段落渲染器 → 图片不显示、标题/加粗也变原文。unwrapMarkdownFence 在渲染边界
// 外科手术式地剥掉「整段被空/markdown 围栏包裹」这一种，绝不误伤正文里合法的代码块。

const F = "`".repeat(3) // ```

describe("unwrapMarkdownFence", () => {
  it("unwraps a whole-document ```markdown fence", () => {
    const inner = "## 标题\n\n正文段落\n\n{{IMAGE: timeline | 标题 | a, b}}"
    const wrapped = `${F}markdown\n${inner}\n${F}`
    expect(unwrapMarkdownFence(wrapped)).toBe(inner)
  })

  it("unwraps a whole-document bare ``` fence (no info string)", () => {
    const inner = "## 标题\n\n正文"
    expect(unwrapMarkdownFence(`${F}\n${inner}\n${F}`)).toBe(inner)
  })

  it("unwraps a ```md fence too", () => {
    const inner = "正文"
    expect(unwrapMarkdownFence(`${F}md\n${inner}\n${F}`)).toBe(inner)
  })

  it("tolerates leading/trailing whitespace and blank lines around the fence", () => {
    const inner = "## 标题\n\n正文"
    const wrapped = `\n\n  ${F}markdown\n${inner}\n${F}  \n\n`
    expect(unwrapMarkdownFence(wrapped)).toBe(inner)
  })

  it("leaves plain markdown (no wrapping fence) unchanged", () => {
    const plain = "## 标题\n\n正文\n\n{{IMAGE: a | b | c}}"
    expect(unwrapMarkdownFence(plain)).toBe(plain)
  })

  it("does NOT unwrap a real fenced code block that is only part of the doc", () => {
    const doc = `这是一段教程摘要：\n\n${F}python\nprint(1)\n${F}\n\n继续正文`
    expect(unwrapMarkdownFence(doc)).toBe(doc)
  })

  it("does NOT strip a ```python whole-doc code block (legit code, wrong lang)", () => {
    const doc = `${F}python\nprint(1)\n${F}`
    expect(unwrapMarkdownFence(doc)).toBe(doc)
  })

  it("does NOT unwrap when the body itself contains an inner fence (ambiguous)", () => {
    const doc = `${F}markdown\n## 标题\n\n${F}js\nx\n${F}\n\n正文\n${F}`
    expect(unwrapMarkdownFence(doc)).toBe(doc)
  })

  it("returns empty/falsy input unchanged", () => {
    expect(unwrapMarkdownFence("")).toBe("")
  })

  it("preserves the {{IMAGE: ...}} pipe-format placeholders verbatim after unwrap", () => {
    const ph = "{{IMAGE: timeline | 雷军早期创业 | 三色公司倒闭, 盘古惨败}}"
    const wrapped = `${F}markdown\n## 标题\n\n${ph}\n${F}`
    expect(unwrapMarkdownFence(wrapped)).toContain(ph)
  })
})
