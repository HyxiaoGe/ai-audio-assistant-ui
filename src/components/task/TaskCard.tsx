import { FileText, Video, Mic } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/lib/i18n-context';

interface TaskCardProps {
  id: string;
  title: string;
  duration: string;
  timeAgo: string;
  status: 'completed' | 'processing' | 'failed';
  type?: 'video' | 'audio' | 'file';
  onClick?: () => void;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export default function TaskCard({ 
  title, 
  duration, 
  timeAgo, 
  status, 
  type = 'file',
  onClick,
  onRetry,
  isRetrying = false
}: TaskCardProps) {
  const { t } = useI18n();
  
  const getIcon = () => {
    switch (type) {
      case 'video':
        return <Video className="w-6 h-6" />;
      case 'audio':
        return <Mic className="w-6 h-6" />;
      default:
        return <FileText className="w-6 h-6" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'completed':
        return t("task.status.completed");
      case 'processing':
        return t("status.processing");
      case 'failed':
        return t("task.status.failed");
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.();
        }
      }}
      className="glass-item w-full rounded-xl p-5 flex items-center justify-between group"
    >
      {/* 左侧：图标 + 信息 */}
      <div className="flex items-center gap-4">
        {/* 图标 */}
        <div 
          className="w-6 h-6 flex items-center justify-center flex-shrink-0"
          style={{ color: "var(--app-text-muted)" }}
        >
          {getIcon()}
        </div>

        {/* 文字信息 */}
        <div className="text-left">
          {/* 标题 */}
          <div 
            className="text-base mb-1"
            style={{ 
              fontWeight: 500,
              color: "var(--app-text)"
            }}
          >
            {title}
          </div>
          
          {/* 副信息 */}
          <div 
            className="text-sm"
            style={{ color: "var(--app-text-muted)" }}
          >
            {duration} · {timeAgo}
          </div>
        </div>
      </div>

      {/* 右侧：状态Badge + 重试 */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <Badge variant={status}>
          {getStatusText()}
        </Badge>
        {status === "failed" && onRetry && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRetry();
            }}
            disabled={isRetrying}
            className="px-3 py-1.5 rounded text-xs transition-colors bg-[var(--app-danger)] hover:bg-[#b91c1c] active:bg-[#991b1b] dark:hover:bg-[#f87171] dark:active:bg-[#ef4444] disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              color: "var(--app-button-primary-text)",
              fontWeight: 500
            }}
          >
            {isRetrying ? t("common.processing") : t("common.retry")}
          </button>
        )}
      </div>
    </div>
  );
}
