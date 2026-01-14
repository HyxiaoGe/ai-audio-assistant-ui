"use client";

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useGlobalStore } from '@/store/global-store';
import { useI18n } from '@/lib/i18n-context';
import NotificationItem from './NotificationItem';

interface NotificationPanelProps {
  onClose?: () => void;
}

export default function NotificationPanel({ onClose }: NotificationPanelProps) {
  const { t } = useI18n();
  const notifications = useGlobalStore((state) => state.notifications);
  const markAsRead = useGlobalStore((state) => state.markAsRead);
  const markAllAsRead = useGlobalStore((state) => state.markAllAsRead);
  const clearNotifications = useGlobalStore((state) => state.clearNotifications);

  const handleMarkAsRead = (id: string) => {
    markAsRead(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  const handleClearAll = () => {
    clearNotifications();
    onClose?.();
  };

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
          {notifications.length > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t('notifications.markAllRead')}
            </button>
          )}
        </div>
      </div>

      {/* Notification List */}
      <div className="flex-1 overflow-y-auto p-2">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('notifications.empty')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.slice(0, 10).map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={handleMarkAsRead}
                showActions
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClearAll}
            className="w-full text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            {t('notifications.clear')}
          </button>
        </div>
      )}
    </div>
  );
}
