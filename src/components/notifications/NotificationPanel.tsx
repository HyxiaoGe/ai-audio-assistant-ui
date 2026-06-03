"use client";

import Link from 'next/link';
import { useGlobalStore } from '@/store/global-store';
import { useI18n } from '@/lib/i18n-context';
import NotificationList from './NotificationList';

interface NotificationPanelProps {
  onClose?: () => void;
}

export default function NotificationPanel({ onClose }: NotificationPanelProps) {
  const { t } = useI18n();
  const unreadCount = useGlobalStore((state) => state.unreadCount);
  const markAllAsRead = useGlobalStore((state) => state.markAllAsRead);

  return (
    <div className="w-80 max-h-[500px] flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('notifications.title')}
        </h3>
        <div className="flex items-center gap-3 text-xs">
          <Link
            href="/notifications"
            className="text-blue-600 dark:text-blue-400 hover:underline"
            onClick={() => onClose?.()}
          >
            {t('notifications.viewAll')}
          </Link>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsRead()}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t('notifications.markAllRead')}
            </button>
          )}
        </div>
      </div>

      {/* Shared list (panel variant): owns list + empty/loading/error + 清空 footer */}
      <div className="flex-1 overflow-y-auto p-2">
        <NotificationList variant="panel" onItemActivate={onClose} />
      </div>
    </div>
  );
}
