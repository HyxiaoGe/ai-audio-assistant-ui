import DiffMatchPatch from "diff-match-patch";

export interface DiffSegment {
  type: "equal" | "insert" | "delete" | "replace";
  text: string;
  originalText?: string;
}

/**
 * Compare original and polished text, producing word-level diff segments.
 *
 * Adjacent delete+insert pairs are merged into a single "replace" segment
 * so the UI shows one clickable element instead of two.
 */
export function computeDiff(
  original: string,
  polished: string
): DiffSegment[] {
  const dmp = new DiffMatchPatch();
  const diffs = dmp.diff_main(original, polished);
  dmp.diff_cleanupSemantic(diffs);

  const segments: DiffSegment[] = [];
  let i = 0;

  while (i < diffs.length) {
    const [op, text] = diffs[i];

    if (op === 0) {
      segments.push({ type: "equal", text });
      i++;
    } else if (op === -1) {
      const next = diffs[i + 1];
      if (next && next[0] === 1) {
        segments.push({
          type: "replace",
          text: next[1],
          originalText: text,
        });
        i += 2;
      } else {
        segments.push({
          type: "delete",
          text: "",
          originalText: text,
        });
        i++;
      }
    } else if (op === 1) {
      segments.push({ type: "insert", text });
      i++;
    } else {
      i++;
    }
  }

  return segments;
}
