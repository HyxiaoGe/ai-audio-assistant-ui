"use client";

import { useState } from 'react';
import { Globe } from 'lucide-react';
import { useAPIClient } from '@/lib/use-api-client';
import { useI18n } from '@/lib/i18n-context';
import { useUserStore } from '@/store/user-store';
import { notifyError, notifySuccess } from '@/lib/notify';

interface TaskVisibilityToggleProps {
  taskId: string;
  status: string;
  isPublic: boolean;
  onChanged: (isPublic: boolean, publishedAt: string | null) => void;
}

/**
 * 管理员专用:把自己的 completed 任务设为公开/取消公开(探索广场)。
 * 非管理员/资料未加载/任务未完成时不渲染——后端同样硬校验,这里只是入口收敛。
 */
export function TaskVisibilityToggle({ taskId, status, isPublic, onChanged }: TaskVisibilityToggleProps) {
  const { t } = useI18n();
  const client = useAPIClient();
  const isAdmin = useUserStore((s) => s.isAdmin);
  const profileLoaded = useUserStore((s) => s.profileLoaded);
  const [busy, setBusy] = useState(false);

  if (!profileLoaded || !isAdmin || status !== 'completed') return null;

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await client.updateTaskVisibility(taskId, !isPublic);
      onChanged(result.is_public, result.published_at);
      notifySuccess(t(result.is_public ? 'task.visibilityPublicSuccess' : 'task.visibilityPrivateSuccess'));
    } catch {
      notifyError(t('task.visibilityFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={() => { void toggle(); }}
      disabled={busy}
      className="flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors hover:bg-[var(--app-glass-bg-strong)] disabled:opacity-60"
      style={{
        borderColor: isPublic ? 'var(--app-primary)' : 'var(--app-border)',
        color: isPublic ? 'var(--app-primary)' : 'var(--app-text-muted)',
      }}
      title={t(isPublic ? 'task.visibilityMakePrivate' : 'task.visibilityMakePublic')}
    >
      <Globe className="w-4 h-4" />
      <span className="text-sm" style={{ fontWeight: 500 }}>
        {t(isPublic ? 'task.visibilityPublic' : 'task.visibilityMakePublic')}
      </span>
    </button>
  );
}
