"use client";

import { CheckSquare } from "lucide-react";

interface ActionItemToggleProps {
  completed: boolean;
  /** 可访问名：通常是待办任务的文本，让读屏读出「{任务}, 复选框, 已选中/未选中」。 */
  label: string;
  onToggle: () => void;
}

/**
 * 待办项完成开关：用 role="checkbox" + aria-checked 暴露勾选语义（audit a11y #34）。
 * 视觉仍是 CheckSquare 图标 / 空方框，但对读屏由 role/state 承载，图标本身 aria-hidden。
 */
export function ActionItemToggle({ completed, label, onToggle }: ActionItemToggleProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={completed}
      aria-label={label}
      onClick={onToggle}
      className="flex-shrink-0 mt-0.5"
    >
      {completed ? (
        <CheckSquare className="w-5 h-5" style={{ color: 'var(--app-success)' }} aria-hidden="true" />
      ) : (
        <div
          className="w-5 h-5 border-2 rounded"
          style={{ borderColor: 'var(--app-glass-border)' }}
          aria-hidden="true"
        />
      )}
    </button>
  );
}
