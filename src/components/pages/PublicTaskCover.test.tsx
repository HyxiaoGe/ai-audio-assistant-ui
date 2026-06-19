import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import PublicTaskCover from "./PublicTaskCover"

describe("PublicTaskCover 三级回落(cover_url → cover_fallback_url → 占位)", () => {
  it("有 cover_url 渲染主封面 <img>", () => {
    render(<PublicTaskCover coverUrl="/api/v1/public/youtube-thumbnail/abc" fallbackUrl="/ai.webp" alt="封面" />)
    expect(screen.getByRole("img")).toHaveAttribute("src", "/api/v1/public/youtube-thumbnail/abc")
  })

  it("主封面加载失败 → 切到 cover_fallback_url(AI 配图)", () => {
    render(<PublicTaskCover coverUrl="/api/v1/public/youtube-thumbnail/abc" fallbackUrl="/ai.webp" alt="封面" />)
    fireEvent.error(screen.getByRole("img"))
    expect(screen.getByRole("img")).toHaveAttribute("src", "/ai.webp")
  })

  it("主封面与回落都失败 → 占位(无 <img>)", () => {
    render(<PublicTaskCover coverUrl="/cover.jpg" fallbackUrl="/ai.webp" alt="封面" />)
    fireEvent.error(screen.getByRole("img")) // cover 失败 → fallback
    fireEvent.error(screen.getByRole("img")) // fallback 失败 → 占位
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

  it("无 cover_url 且无回落 → 占位(无 <img>)", () => {
    render(<PublicTaskCover coverUrl={null} alt="封面" />)
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

  it("无 cover_url 但有回落 → 直接渲染回落 <img>", () => {
    render(<PublicTaskCover coverUrl={null} fallbackUrl="/ai.webp" alt="封面" />)
    expect(screen.getByRole("img")).toHaveAttribute("src", "/ai.webp")
  })
})
