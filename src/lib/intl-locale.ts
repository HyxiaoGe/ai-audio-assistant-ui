/**
 * 把 i18n 的 locale 字符串映射到 Intl 数字/百分比格式化用的 BCP-47 标签。
 * 按 "zh" 前缀判定中文，与 i18n-context.resolveMessages 的判定保持一致。
 */
export function resolveNumberFormatLocale(locale: string): "zh-CN" | "en-US" {
  return locale.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US"
}
