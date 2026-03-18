"use client";

import { useState, useMemo } from "react";
import { computeDiff } from "@/lib/text-diff";
import { useI18n } from "@/lib/i18n-context";

interface DiffContentProps {
  content: string;
  originalContent: string;
}

/**
 * Word-level diff display. Modified text has an underline;
 * click to toggle between original and polished text.
 */
export default function DiffContent({
  content,
  originalContent,
}: DiffContentProps) {
  const { t } = useI18n();
  const [showOriginalSet, setShowOriginalSet] = useState<Set<number>>(
    new Set()
  );

  const segments = useMemo(
    () => computeDiff(originalContent, content),
    [originalContent, content]
  );

  const hasChanges = segments.some((s) => s.type !== "equal");
  if (!hasChanges) {
    return <span>{content}</span>;
  }

  const toggleOriginal = (index: number) => {
    setShowOriginalSet((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <span>
      {segments.map((seg, i) => {
        if (seg.type === "equal") {
          return <span key={i}>{seg.text}</span>;
        }

        if (seg.type === "replace") {
          const showingOriginal = showOriginalSet.has(i);
          return (
            <span
              key={i}
              onClick={() => toggleOriginal(i)}
              title={
                showingOriginal
                  ? t("transcript.clickToShowPolished")
                  : t("transcript.clickToShowOriginal")
              }
              style={{
                borderBottom: "2px solid var(--app-primary)",
                cursor: "pointer",
                paddingBottom: "1px",
                background: showingOriginal
                  ? "var(--app-warning-bg, rgba(251,191,36,0.1))"
                  : "var(--app-primary-soft-2, rgba(99,102,241,0.06))",
                borderRadius: "2px",
                transition: "background 0.15s ease",
              }}
            >
              {showingOriginal ? seg.originalText : seg.text}
            </span>
          );
        }

        if (seg.type === "insert") {
          return (
            <span
              key={i}
              style={{
                borderBottom: "2px solid var(--app-success)",
                paddingBottom: "1px",
              }}
            >
              {seg.text}
            </span>
          );
        }

        if (seg.type === "delete") {
          if (!seg.originalText) return null;
          const showingOriginal = showOriginalSet.has(i);
          if (!showingOriginal) return null;
          return (
            <span
              key={i}
              onClick={() => toggleOriginal(i)}
              style={{
                textDecoration: "line-through",
                color: "var(--app-text-muted)",
                cursor: "pointer",
                fontSize: "0.9em",
              }}
            >
              {seg.originalText}
            </span>
          );
        }

        return null;
      })}
    </span>
  );
}
