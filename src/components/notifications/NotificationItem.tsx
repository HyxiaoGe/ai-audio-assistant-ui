"use client";

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Notification } from '@/store/global-store';
import { useI18n } from '@/lib/i18n-context';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead?: (id: string) => void;
}

/**
 * Derive notification type (success/error/info/warning) from backend data
 */
function getNotificationType(notification: Notification): 'success' | 'error' | 'info' | 'warning' {
  if (notification.category === 'task') {
    if (notification.action === 'completed') return 'success';
    if (notification.action === 'failed') return 'error';
    return 'info';
  }

  // System notifications
  if (notification.priority === 'urgent' || notification.priority === 'high') {
    return 'warning';
  }

  return 'info';
}

const iconMap = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const colorMap = {
  success: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-900 dark:text-green-100',
    icon: 'text-green-500',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-900 dark:text-red-100',
    icon: 'text-red-500',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-900 dark:text-blue-100',
    icon: 'text-blue-500',
  },
  warning: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    text: 'text-yellow-900 dark:text-yellow-100',
    icon: 'text-yellow-500',
  },
};

export default function NotificationItem({ notification, onMarkAsRead }: NotificationItemProps) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [now, setNow] = useState(() => Date.now());

  const notificationType = getNotificationType(notification);
  const Icon = iconMap[notificationType];
  const colors = colorMap[notificationType];
  const isRead = !!notification.read_at;

  useEffect(() => {
    const timestamp = new Date(notification.created_at).getTime();
    if (Number.isNaN(timestamp)) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleUpdate = () => {
      const diffMs = Math.abs(Date.now() - timestamp);
      let delay = 60000;
      if (diffMs < 60000) delay = 10000;
      else if (diffMs < 3600000) delay = 60000;
      else if (diffMs < 86400000) delay = 3600000;
      else delay = 86400000;

      timer = setTimeout(() => {
        setNow(Date.now());
        scheduleUpdate();
      }, delay);
    };

    scheduleUpdate();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [notification.created_at]);

  const formatTime = (isoString: string) => {
    const timestamp = new Date(isoString).getTime();
    if (Number.isNaN(timestamp)) return t('common.justNow');

    const diffSeconds = Math.round((timestamp - now) / 1000);
    const absSeconds = Math.abs(diffSeconds);
    if (absSeconds < 10) return t('common.justNow');

    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    if (absSeconds < 60) return rtf.format(diffSeconds, "second");

    const diffMinutes = Math.round(diffSeconds / 60);
    if (absSeconds < 3600) return rtf.format(diffMinutes, "minute");

    const diffHours = Math.round(diffMinutes / 60);
    if (absSeconds < 86400) return rtf.format(diffHours, "hour");

    const diffDays = Math.round(diffHours / 24);
    return rtf.format(diffDays, "day");
  };

  const handleClick = () => {
    if (!isRead && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
    if (notification.action_url) {
      router.push(notification.action_url);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`
        p-3 rounded-lg cursor-pointer transition-all
        ${isRead ? 'opacity-60' : 'opacity-100'}
        ${colors.bg}
        hover:shadow-sm
      `}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <Icon className={`w-5 h-5 ${colors.icon}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <p className={`text-sm font-medium ${colors.text}`}>
            {notification.title}
          </p>
          {/* Message (optional detail) */}
          {notification.message && notification.message !== notification.title && (
            <p className={`text-xs ${colors.text} mt-0.5 opacity-80`}>
              {notification.message}
            </p>
          )}
          {/* Time */}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {formatTime(notification.created_at)}
          </p>
        </div>

        {/* Unread indicator */}
        {!isRead && (
          <div className="flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
          </div>
        )}
      </div>
    </div>
  );
}
