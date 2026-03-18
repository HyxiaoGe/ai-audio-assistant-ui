/**
 * Format a raw model ID into a human-friendly display name.
 *
 * Examples:
 *   "google/gemini-3-pro-image-preview" → "Gemini 3 Pro Image"
 *   "openai/gpt-5.4" → "GPT 5.4"
 *   "deepseek-chat" → "Deepseek Chat"
 */
export function formatModelName(modelId: string): string {
  // Strip provider prefix (e.g. "google/gemini-..." → "gemini-...")
  const name = modelId.includes("/") ? modelId.split("/").pop()! : modelId;

  return (
    name
      // Remove common suffixes
      .replace(/-preview$/, "")
      .replace(/-exp(:\w+)?$/, "")
      // Split on hyphens and capitalize
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ")
  );
}
