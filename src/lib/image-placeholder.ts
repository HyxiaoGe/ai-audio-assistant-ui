/**
 * Utility functions for parsing and handling AI-generated image placeholders
 * in streaming summaries.
 *
 * Placeholder format: {{IMAGE: description}}
 * Example: {{IMAGE: 供应链时间轴}}
 */

const IMAGE_PLACEHOLDER_REGEX = /\{\{IMAGE:\s*([^}]+)\}\}/g

/**
 * Extract the description from an image placeholder string.
 *
 * @param placeholder - The full placeholder string, e.g., "{{IMAGE: 供应链时间轴}}"
 * @returns The extracted description, e.g., "供应链时间轴"
 */
export function extractPlaceholderDescription(placeholder: string): string {
  const match = placeholder.match(/\{\{IMAGE:\s*([^}]+)\}\}/)
  return match ? match[1].trim() : placeholder
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
