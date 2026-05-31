import { describe, expect, it } from "vitest"
import { resolveNumberFormatLocale } from "./intl-locale"

// 把 i18n 的 locale（zh-CN / zh / en-US / en 等）映射到 Intl.NumberFormat 用的 BCP-47 标签。
// Stats 原本读已废弃的 language prop（默认 "zh"，调用方早已不传）→ 百分比始终按 zh-CN 格式化，
// 与实际界面语言脱钩。改为从 useI18n().locale 派生，这里锁定映射（与 i18n-context 的 zh 前缀判定一致）。
describe("resolveNumberFormatLocale", () => {
  it("maps Chinese locales to zh-CN", () => {
    expect(resolveNumberFormatLocale("zh-CN")).toBe("zh-CN")
    expect(resolveNumberFormatLocale("zh")).toBe("zh-CN")
    expect(resolveNumberFormatLocale("ZH-cn")).toBe("zh-CN")
  })

  it("maps non-Chinese locales to en-US", () => {
    expect(resolveNumberFormatLocale("en-US")).toBe("en-US")
    expect(resolveNumberFormatLocale("en")).toBe("en-US")
    expect(resolveNumberFormatLocale("fr")).toBe("en-US")
  })
})
