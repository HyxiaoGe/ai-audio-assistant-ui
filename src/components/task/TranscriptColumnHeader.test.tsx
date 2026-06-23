import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { TranscriptColumnHeader } from "./TranscriptColumnHeader"

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key} ${Object.values(vars).join(" ")}` : key,
  }),
}))

describe("TranscriptColumnHeader", () => {
  it("渲染标题", () => {
    render(<TranscriptColumnHeader title="转写" />)
    expect(screen.getByText("转写")).toBeInTheDocument()
  })

  it("有 asrProviderName 时渲染来源 caption", () => {
    render(<TranscriptColumnHeader title="转写" asrProviderName="腾讯云" />)
    expect(screen.getByText("task.transcribedByCaption 腾讯云")).toBeInTheDocument()
  })

  it("无 asrProviderName 时不渲染 caption", () => {
    render(<TranscriptColumnHeader title="转写" />)
    expect(screen.queryByText(/transcribedByCaption/)).toBeNull()
  })
})
