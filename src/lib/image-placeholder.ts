/**
 * Utility functions for parsing and handling AI-generated image placeholders
 * in streaming summaries.
 *
 * Placeholder format: {{IMAGE: description}}
 * Example: {{IMAGE: 供应链时间轴}}
 */

const IMAGE_PLACEHOLDER_REGEX = /\{\{IMAGE:\s*([^}]+)\}\}/g

/**
 * Extract the human-readable description (title) from an image placeholder string.
 *
 * 兼容两种格式：
 *  - 旧格式 `{{IMAGE: 描述}}`            → 返回「描述」
 *  - 新版管道格式 `{{IMAGE: type | title | keywords}}`（7-style 重构后）→ 返回「title」段，
 *    而非整串 `type | title | keywords`（否则图注/alt 会显示成丑陋的管道串）。
 *
 * @param placeholder - The full placeholder string, e.g., "{{IMAGE: 供应链时间轴}}"
 * @returns The extracted title/description, e.g., "供应链时间轴"
 */
export function extractPlaceholderDescription(placeholder: string): string {
  const match = placeholder.match(/\{\{IMAGE:\s*([^}]+)\}\}/)
  if (!match) return placeholder
  const inner = match[1].trim()
  // 新版管道格式恰为 `type | title | keywords` 三段（关键词内部只用逗号，不含管道）。
  const parts = inner.split("|")
  if (parts.length >= 3) {
    return parts[1].trim()
  }
  return inner
}

/**
 * Find all image placeholders in content.
 *
 * @param content - The markdown content to search
 * @returns Array of placeholder strings found, e.g., ["{{IMAGE: 时间轴}}", "{{IMAGE: 流程图}}"]
 */
export function findImagePlaceholders(content: string): string[] {
  return [...content.matchAll(IMAGE_PLACEHOLDER_REGEX)].map((m) => m[0])
}

/**
 * Check if a string contains an image placeholder.
 *
 * @param text - The text to check
 * @returns true if the text contains a placeholder
 */
export function containsImagePlaceholder(text: string): boolean {
  return IMAGE_PLACEHOLDER_REGEX.test(text)
}

/**
 * Check if a string is a complete image placeholder (not partial).
 * This helps avoid rendering incomplete placeholders during streaming.
 *
 * @param text - The text to check
 * @returns true if text is exactly a complete placeholder
 */
export function isCompleteImagePlaceholder(text: string): boolean {
  const trimmed = text.trim()
  // Must start with {{ and end with }}
  if (!trimmed.startsWith("{{") || !trimmed.endsWith("}}")) {
    return false
  }
  // Must match the pattern exactly
  const match = trimmed.match(/^\{\{IMAGE:\s*([^}]+)\}\}$/)
  return match !== null
}

/**
 * Extract the placeholder string from text that may contain surrounding content.
 *
 * @param text - Text potentially containing a placeholder
 * @returns The placeholder string if found, or null
 */
export function extractImagePlaceholder(text: string): string | null {
  const match = text.match(/\{\{IMAGE:\s*[^}]+\}\}/)
  return match ? match[0] : null
}
