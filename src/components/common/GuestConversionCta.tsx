import { Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";

interface GuestConversionCtaProps {
  onLogin: () => void;
}

/**
 * 匿名访客在公开任务详情页底部的登录转化常驻条。
 * 仅在确定未登录(status==="unauthenticated")时由调用方渲染。
 */
export default function GuestConversionCta({ onLogin }: GuestConversionCtaProps) {
  const { t } = useI18n();
  return (
    <div
      className="flex items-center gap-4 px-6 py-4 border-t"
      style={{ borderColor: "var(--app-glass-border)", background: "var(--app-glass-bg)" }}
    >
      <Sparkles className="w-6 h-6 shrink-0" style={{ color: "var(--app-primary)" }} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm" style={{ fontWeight: 600, color: "var(--app-text)" }}>
          {t("explore.guestCtaTitle")}
        </p>
        <p className="text-xs" style={{ color: "var(--app-text-muted)" }}>
          {t("explore.guestCtaSubtitle")}
        </p>
      </div>
      <button
        onClick={onLogin}
        className="shrink-0 px-5 py-2.5 rounded-lg text-sm transition-opacity hover:opacity-90"
        style={{ background: "var(--app-primary)", color: "var(--app-button-primary-text)", fontWeight: 500 }}
      >
        {t("explore.guestCtaButton")}
      </button>
    </div>
  );
}
