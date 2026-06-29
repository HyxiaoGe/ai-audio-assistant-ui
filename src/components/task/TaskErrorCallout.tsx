import { AlertCircle } from "lucide-react";

/** 失败原因提示框:危险色软底 + 边框 + 图标,替代生红字。 */
export function TaskErrorCallout({ message, className }: { message: string; className?: string }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border border-[var(--app-danger-border)] bg-[var(--app-danger-bg-soft)] px-3 py-2 text-xs leading-relaxed text-[var(--app-danger-deep)] ${className ?? ""}`}
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className="break-words">{message}</span>
    </div>
  );
}
