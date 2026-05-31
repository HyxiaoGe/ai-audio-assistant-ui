"use client";

import { Search } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";

interface TaskSearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * 任务列表搜索框。
 *
 * 无障碍：输入框补 aria-label（placeholder 对读屏不可靠），清除按钮补 type="button"，
 * 装饰性放大镜图标 aria-hidden。
 */
export function TaskSearchInput({ value, onChange }: TaskSearchInputProps) {
  const { t } = useI18n();

  return (
    <div className="relative max-w-md">
      <div className="absolute left-3 top-1/2 -translate-y-1/2">
        <Search
          aria-hidden="true"
          className="w-5 h-5"
          style={{ color: "var(--app-text-subtle)" }}
        />
      </div>
      <input
        type="text"
        aria-label={t("tasks.searchPlaceholder")}
        placeholder={t("tasks.searchPlaceholder")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="glass-control w-full pl-10 pr-4 py-2.5 rounded-lg text-sm"
        style={{ color: "var(--app-text)" }}
      />
      {value && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <button
            type="button"
            onClick={() => onChange("")}
            className="glass-chip text-xs px-2 py-1 rounded"
            style={{ color: "var(--app-text-subtle)" }}
          >
            {t("tasks.clearSearch")}
          </button>
        </div>
      )}
    </div>
  );
}
