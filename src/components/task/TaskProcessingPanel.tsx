import { Music, Info } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import ProcessingState from '@/components/common/ProcessingState';
import type { TaskDetail } from '@/types/api';

interface TaskProcessingPanelProps {
  task: TaskDetail;
  infoItems: string[];
  progress: number;
  estimatedTime: string;
}

export function TaskProcessingPanel({ task, infoItems, progress, estimatedTime }: TaskProcessingPanelProps) {
  const { t } = useI18n();
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
      {/* 文件信息卡片 */}
      <div
        className="w-full mb-6 p-4 rounded-lg border"
        style={{
          maxWidth: '480px',
          background: 'var(--app-glass-bg)',
          backdropFilter: 'blur(10px)',
          borderColor: 'var(--app-glass-border)'
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--app-primary-soft-2)' }}
          >
            <Music className="w-5 h-5" style={{ color: 'var(--app-primary)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm truncate" style={{ fontWeight: 600, color: 'var(--app-text-strong)' }}>
              {task.title}
            </h3>
            {infoItems.length > 0 && (
              <div className="flex items-center gap-3 mt-1">
                {infoItems.map((item, index) => (
                  <span key={`${item}-${index}`} className="text-xs flex items-center gap-3" style={{ color: 'var(--app-text-subtle)' }}>
                    {item}
                    {index < infoItems.length - 1 && (
                      <span className="text-xs" style={{ color: 'var(--app-text-faint)' }}>·</span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Processing State */}
      <ProcessingState
        progress={progress}
        estimatedTime={estimatedTime}
        status={task.status}
        sourceType={task.source_type}
      />

      {/* 底部提示信息 */}
      <div
        className="w-full mt-6 text-center"
        style={{ maxWidth: '480px' }}
      >
        <div
          className="flex items-start gap-2 p-4 rounded-lg"
          style={{ background: 'var(--app-primary-soft-2)' }}
        >
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--app-primary)' }} />
          <p className="text-xs text-left" style={{ color: 'var(--app-text-muted)', lineHeight: '1.5' }}>
            {t("task.error.processingTips")}
          </p>
        </div>
      </div>
    </div>
  );
}
