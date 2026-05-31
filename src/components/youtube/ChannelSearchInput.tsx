"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n-context";

interface ChannelSearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * 订阅频道搜索框。
 *
 * 无障碍：清除按钮使用 type="button" 并带 aria-label，图标 aria-hidden，
 * 使读屏用户可识别其用途。
 */
export function ChannelSearchInput({ value, onChange }: ChannelSearchInputProps) {
  const { t } = useI18n();

  return (
    <div className="relative mt-3">
      <Search
        aria-hidden="true"
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
        style={{ color: "var(--app-text-muted)" }}
      />
      <Input
        placeholder={t("subscriptions.searchPlaceholder")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 pr-9"
        style={{
          background: "var(--app-glass-bg)",
          borderColor: "var(--app-glass-border)",
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("subscriptions.clearSearch")}
          className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
          style={{ color: "var(--app-text-muted)" }}
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
