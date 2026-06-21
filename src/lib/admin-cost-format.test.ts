import { describe, expect, it } from "vitest"
import { formatMoney, formatUserName, isLlmUnavailable } from "./admin-cost-format"

describe("formatMoney", () => {
  it("keeps up to 4 decimals for tiny costs (e.g. $0.0064)", () => {
    expect(formatMoney(0.0064, "$")).toBe("$0.0064")
  })

  it("collapses to 2 decimals when the 3rd/4th are zero", () => {
    expect(formatMoney(3.5, "¥")).toBe("¥3.50")
    expect(formatMoney(1.25, "¥")).toBe("¥1.25")
    expect(formatMoney(0.25, "¥")).toBe("¥0.25")
  })

  it("renders zero as symbol + 0.00", () => {
    expect(formatMoney(0, "¥")).toBe("¥0.00")
  })
})

describe("isLlmUnavailable", () => {
  it("is true when the source is unavailable", () => {
    expect(isLlmUnavailable(null, "unavailable")).toBe(true)
    expect(isLlmUnavailable(1.23, "unavailable")).toBe(true)
  })

  it("is true when the per-row value is null even if source is litellm", () => {
    expect(isLlmUnavailable(null, "litellm")).toBe(true)
  })

  it("is false when source is litellm and value present (including 0)", () => {
    expect(isLlmUnavailable(0, "litellm")).toBe(false)
    expect(isLlmUnavailable(0.0064, "litellm")).toBe(false)
  })
})

describe("formatUserName", () => {
  const opts = { fallback: "未命名用户", selfSuffix: "（你）" }

  it("appends the self suffix when the row is the current viewer", () => {
    expect(formatUserName("sean", { ...opts, isSelf: true })).toBe("sean（你）")
  })

  it("renders the name as-is when not the current viewer", () => {
    expect(formatUserName("sean", { ...opts, isSelf: false })).toBe("sean")
  })

  it("uses the fallback with suffix when name is null and is self", () => {
    expect(formatUserName(null, { ...opts, isSelf: true })).toBe("未命名用户（你）")
  })

  it("uses the bare fallback when name is null and not self", () => {
    expect(formatUserName(null, { ...opts, isSelf: false })).toBe("未命名用户")
  })
})
