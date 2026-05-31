import mermaid from "mermaid"

// mermaid.initialize 原本在 VisualSummaryView 的 per-instance useEffect 里，每个可视化
// 实例挂载都重跑一次。抽成模块级幂等单例：首个可视化组件挂载时初始化一次，后续调用直接返回。
let initialized = false

/**
 * 幂等初始化 mermaid（多次调用只真正初始化一次）。
 *
 * securityLevel:"strict" 是安全控制：图表文本来自后端 LLM 生成内容（不可信），再经
 * `mermaidRef.innerHTML = svg` 注入 DOM。strict 会启用 mermaid 内置 DOMPurify 净化、
 * 禁用 label 内 HTML 与 click 交互，阻断经 innerHTML 注入的存储型 XSS —— 不可放宽。
 */
export function initMermaid(): void {
  if (initialized) return
  initialized = true
  mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "strict",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
  })
}
