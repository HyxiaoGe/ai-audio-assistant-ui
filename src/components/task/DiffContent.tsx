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

  // 键盘可达：Enter/Space 切换原文/校对文本
  const handleToggleKeyDown = (
    event: React.KeyboardEvent<HTMLSpanElement>,
    index: number
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleOriginal(index);
    }
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
              role="button"
              tabIndex={0}
              aria-pressed={showingOriginal}
              onClick={() => toggleOriginal(i)}
              onKeyDown={(event) => handleToggleKeyDown(event, i)}
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
          // 注：纯 delete 段仅在 showOriginalSet.has(i) 时渲染，而能把 i 加入该集合的
          // 只有本段自身的点击；该段在 !showingOriginal 时已 return null，故实际不可达
          // （鼠标和键盘都无法触达）。因此此处不附加 role/tabIndex/键盘语义，避免给
          // 永不挂载的节点添加误导性无障碍属性（尤其 aria-pressed 恒为 true）。保持 master 原样。
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
