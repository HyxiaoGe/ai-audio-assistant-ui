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

  const parts = name
    // Remove common suffixes
    .replace(/-preview$/, "")
    .replace(/-exp(:\w+)?$/, "")
    .split("-");

  // Merge runs of adjacent pure-numeric segments into a dotted version so a model id like
  // "doubao-seedream-4-5" reads as "Doubao Seedream 4.5" instead of "Doubao Seedream 4 5".
  const merged: string[] = [];
  for (const part of parts) {
    const prev = merged[merged.length - 1];
    if (/^\d+$/.test(part) && prev !== undefined && /^\d+(\.\d+)*$/.test(prev)) {
      merged[merged.length - 1] = `${prev}.${part}`;
    } else {
      merged.push(part);
    }
  }

  return merged.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
}
