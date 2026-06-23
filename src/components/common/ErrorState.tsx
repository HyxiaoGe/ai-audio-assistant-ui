import { RefreshCw, XCircle, AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';

interface ErrorStateProps {
  type?: 'network' | 'processing' | 'general';
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export default function ErrorState({
  type = 'general',
  title,
  description,
  onRetry,
  retryLabel
}: ErrorStateProps) {
  const { t } = useI18n();
  // 默认配置
  const configs: Record<NonNullable<ErrorStateProps['type']>, { icon: LucideIcon; defaultTitle: string; defaultDescription: string }> = {
    network: {
      icon: XCircle,
      defaultTitle: t("errors.networkFailedTitle"),
      defaultDescription: t("errors.networkFailedDesc")
    },
    processing: {
      icon: AlertTriangle,
      defaultTitle: t("errors.processFailedTitle"),
      defaultDescription: t("errors.processFailedDesc")
    },
    general: {
      icon: AlertTriangle,
      defaultTitle: t("errors.unknownErrorTitle"),
      defaultDescription: t("errors.unknownError")
    }
  };

  const config = configs[type];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {/* Icon */}
      <div className="mb-4" aria-hidden="true">
        <Icon className="w-16 h-16" style={{ color: "var(--app-text-muted)", opacity: 0.6 }} />
      </div>

      {/* Title */}
      <h3 
        className="text-xl mb-2"
        style={{ 
          color: "var(--app-text)",
          fontWeight: 600
        }}
      >
        {title || config.defaultTitle}
      </h3>

      {/* Description */}
      <p 
        className="text-base mb-6 text-center max-w-sm"
        style={{ color: "var(--app-text-muted)" }}
      >
        {description || config.defaultDescription}
      </p>

      {/* Retry Button */}
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg transition-all text-sm"
          style={{
            background: "var(--app-primary)",
            color: "var(--app-button-primary-text)",
            fontWeight: 500
          }}
        >
          <RefreshCw className="w-4 h-4" />
          {retryLabel || t("common.retry")}
        </button>
      )}
    </div>
  );
}
