import { render } from "@testing-library/react"
import { describe, expect, it, vi, type Mock } from "vitest"
import mermaid from "mermaid"
import { VisualSummaryView } from "./VisualSummaryView"
import type { SummaryItem } from "@/types/api"

// VisualSummaryView 渲染的是后端 LLM 生成的 mermaid 文本（VisualSummaryResponse.content），
// 再经 mermaidRef.innerHTML = svg 注入。若用 securityLevel:"loose"，mermaid 会放行 label 内的
// HTML / click 交互并跳过其内置 DOMPurify —— 配合 token 存于 localStorage，构成存储型 XSS →
// 认证态盗 token 的路径。本测试锁定安全控制：mermaid 必须以加固的 securityLevel 初始化。

vi.mock("@/lib/use-api-client", () => ({
  useAPIClient: () => ({ getVisualSummary: vi.fn() }),
}))

vi.mock("@/lib/media-url", () => ({
  appendMediaToken: (url: string | null) => url ?? "",
  useMediaToken: () => null,
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
    image_url: null,
    image_model_used: null,
    ...overrides,
  }
}

describe("VisualSummaryView XSS hardening", () => {
  it("initializes mermaid with securityLevel 'strict' (not 'loose'), so backend/LLM diagram content cannot inject active markup through innerHTML", () => {
    render(
      <VisualSummaryView
        taskId="task-1"
        visualType="mindmap"
        renderMode="mermaid"
        initialData={visualSummary()}
      />
    )

    const initializeMock = mermaid.initialize as unknown as Mock
    expect(initializeMock).toHaveBeenCalled()
    expect(initializeMock).toHaveBeenCalledWith(
      expect.objectContaining({ securityLevel: "strict" })
    )
  })
})
