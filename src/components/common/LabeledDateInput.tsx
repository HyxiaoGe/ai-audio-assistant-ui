"use client";

interface LabeledDateInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * 带程序化关联标签的日期输入。
 *
 * 无障碍：通过 <label htmlFor> ↔ <input id> 关联可见标签，使读屏可念出字段名，
 * 点击标签也能聚焦输入框。
 */
export function LabeledDateInput({
  id,
  label,
  value,
  onChange,
  className = "glass-control h-9 rounded-md px-3 text-sm",
}: LabeledDateInputProps) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block text-xs text-[var(--app-text-muted)]"
      >
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
      />
    </div>
  );
}
