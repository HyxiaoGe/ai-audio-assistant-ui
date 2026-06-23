import { AlertCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import type { TaskDetail } from '@/types/api';

interface TaskFailedPanelProps {
  task: TaskDetail;
  onRetry: () => void;
  isRetrying: boolean;
}

export function TaskFailedPanel({ task, onRetry, isRetrying }: TaskFailedPanelProps) {
  const { t } = useI18n();
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
      <div
        className="w-full rounded-xl border p-10 text-center"
        style={{ maxWidth: '480px', borderColor: 'var(--app-danger-border)', background: 'var(--app-danger-bg-soft)' }}
      >
        <div className="flex justify-center mb-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: 'var(--app-danger-bg)', color: 'var(--app-danger)' }}
          >
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>
        <h2 className="text-xl mb-2" style={{ fontWeight: 600, color: 'var(--app-danger-deep)' }}>
          {t("task.error.processingFailed")}
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--app-danger-strong)' }}>
          {task.error_message || t("task.error.transcribeUnavailable")}
        </p>
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="px-6 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'var(--app-danger)', color: 'var(--app-button-primary-text)' }}
        >
          {isRetrying ? t("common.processing") : t("task.retryProcessing")}
        </button>
      </div>
    </div>
  );
}
