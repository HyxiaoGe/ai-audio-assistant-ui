import { describe, expect, it, vi, type Mock } from "vitest"
import mermaid from "mermaid"
import { initMermaid } from "./mermaid-init"

// mermaid.initialize 原本放在 VisualSummaryView 的 per-instance useEffect 里，每个可视化
// 实例挂载都重跑一次。抽成模块级幂等单例：多次调用只真正初始化一次，且必须保持加固的
// securityLevel:"strict"（不可信的后端/LLM 图表文本经 innerHTML 注入，strict 才会启用
// mermaid 内置 DOMPurify 净化并禁用 label HTML / click 交互，阻断存储型 XSS）。
vi.mock("mermaid", () => ({
  default: { initialize: vi.fn() },
}))

describe("initMermaid", () => {
  it("initializes mermaid exactly once across repeated calls, with hardened securityLevel 'strict'", () => {
    initMermaid()
    initMermaid()
    initMermaid()

    const initialize = mermaid.initialize as unknown as Mock
    expect(initialize).toHaveBeenCalledTimes(1)
    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({ securityLevel: "strict", startOnLoad: false })
    )
  })
})
