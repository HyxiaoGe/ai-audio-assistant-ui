import { describe, expect, it } from "vitest"
import { formatModelName } from "./model-name"

describe("formatModelName", () => {
  it("strips provider prefix and capitalizes words", () => {
    expect(formatModelName("google/gemini-3-pro-image-preview")).toBe("Gemini 3 Pro Image")
    expect(formatModelName("deepseek-chat")).toBe("Deepseek Chat")
  })

  it("merges adjacent numeric segments into a dotted version (doubao-seedream-4-5 → 4.5)", () => {
    // 配图模型 doubao-seedream-4-5 原会被拆成「4 5」两段,读着别扭;相邻纯数字段应合成「4.5」。
    expect(formatModelName("doubao-seedream-4-5")).toBe("Doubao Seedream 4.5")
  })

  it("does not merge a lone trailing number into the preceding word", () => {
    expect(formatModelName("gpt-image-1")).toBe("Gpt Image 1")
  })

  it("keeps a single numeric segment surrounded by words intact", () => {
    expect(formatModelName("gemini-3-pro")).toBe("Gemini 3 Pro")
  })
})
