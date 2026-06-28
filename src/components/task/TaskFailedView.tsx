import { useState } from 'react';
import { useI18n } from '@/lib/i18n-context';
import { Button } from '@/components/ui/button';
import { TaskDetailHeader } from '@/components/task/TaskDetailHeader';
import { TaskFailedPanel } from '@/components/task/TaskFailedPanel';
import { DeleteTaskDialog } from '@/components/task/DeleteTaskDialog';
import type { TaskDetail } from '@/types/api';

interface TaskFailedViewProps {
  task: TaskDetail;
  onBack: () => void;
  onRetry: () => void;
  isRetrying: boolean;
  onConfirmDelete: () => void;
  isDeleting: boolean;
}

export function TaskFailedView({
  task,
  onBack,
  onRetry,
  isRetrying,
  onConfirmDelete,
  isDeleting,
}: TaskFailedViewProps) {
  const { t } = useI18n();
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <TaskDetailHeader
        title={task.title}
        onBack={onBack}
        right={
          <Button
            variant="outline"
            onClick={() => setDeleteOpen(true)}
            className="border-[var(--app-danger-border)] text-[var(--app-danger)] hover:bg-[var(--app-danger-bg-soft)] hover:text-[var(--app-danger)]"
          >
            {t("common.delete")}
          </Button>
        }
      />
      <TaskFailedPanel task={task} onRetry={onRetry} isRetrying={isRetrying} />
      <DeleteTaskDialog
        open={deleteOpen}
        isDeleting={isDeleting}
        onClose={() => setDeleteOpen(false)}
        onConfirm={onConfirmDelete}
        title={task.title}
      />
    </div>
  );
}
