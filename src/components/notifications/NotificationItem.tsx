"use client";

import { memo, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Notification } from '@/store/global-store';
import { useI18n } from '@/lib/i18n-context';
import { getNotificationVariant } from '@/lib/notification-variant';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead?: (id: string) => void;
  showActions?: boolean;
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

function NotificationItem({
  notification,
  onMarkAsRead,
  showActions = false,
}: NotificationItemProps) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  // 每次渲染都 new 一个 Intl.RelativeTimeFormat 是无谓分配（列表里更明显）；按 locale 记忆化。
  const rtf = useMemo(() => new Intl.RelativeTimeFormat(locale, { numeric: "auto" }), [locale]);

  const notificationType = getNotificationVariant(notification.type);
  const Icon = iconMap[notificationType];
  const colors = colorMap[notificationType];
  const isRead = !!notification.read_at;

  const titleKey = `notif.${notification.type}.title`;
  const bodyKey = `notif.${notification.type}.body`;
  const renderedTitle = t(titleKey, notification.params as Record<string, string | number>);
  const renderedBody = t(bodyKey, notification.params as Record<string, string | number>);
  // useI18n's t() returns the key itself when missing -> use that as the "missing" signal.
  const displayTitle = renderedTitle === titleKey ? (notification.title ?? "") : renderedTitle;
  const displayBody = renderedBody === bodyKey ? (notification.message ?? "") : renderedBody;

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

    if (absSeconds < 60) return rtf.format(diffSeconds, "second");

    const diffMinutes = Math.round(diffSeconds / 60);
    if (absSeconds < 3600) return rtf.format(diffMinutes, "minute");

    const diffHours = Math.round(diffMinutes / 60);
    if (absSeconds < 86400) return rtf.format(diffHours, "hour");

    const diffDays = Math.round(diffHours / 24);
    return rtf.format(diffDays, "day");
  };

  const handleMarkRead = () => {
    if (!isRead && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
  };

  const handleOpen = () => {
    handleMarkRead();
    if (notification.action_url) {
      router.push(notification.action_url);
    }
  };

  const handleActivate = handleOpen;

  // 键盘可达：仅当焦点在整行本身时响应 Enter/Space（内部「查看详情」按钮的按键冒泡
  // 上来时 target!==currentTarget，不会重复触发）。
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleActivate();
    }
  };

  return (
    // 外层为展示性容器：整行 button 与「查看详情」按钮作为同级，避免交互元素相互嵌套
    // （button-in-button 反模式）。relative 用于给「查看详情」按钮提供绝对定位参照。
    <div className="relative">
      <div
        role="button"
        tabIndex={0}
        aria-label={displayTitle}
        onClick={handleActivate}
        onKeyDown={handleKeyDown}
        className={`
          p-3 rounded-lg cursor-pointer transition-all
          ${isRead ? 'opacity-60' : 'opacity-100'}
          ${!isRead ? 'animate-in fade-in slide-in-from-top-1 duration-300' : ''}
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
            <div className="flex items-start justify-between gap-3">
              <p className={`text-sm font-medium ${colors.text}`}>
                {displayTitle}
              </p>
              {!isRead && (
                <div className="flex-shrink-0 mt-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                </div>
              )}
            </div>
            {/* Message (optional detail) */}
            {displayBody && displayBody !== displayTitle && (
              <p className={`text-xs ${colors.text} mt-1 opacity-80 leading-relaxed`}>
                {displayBody}
              </p>
            )}
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatTime(notification.created_at)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 「查看详情」：role="button" 整行之外的同级元素，绝对定位回原右下角位置 */}
      {showActions && notification.action_url && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            handleOpen();
          }}
          className="absolute bottom-3 right-3 z-10 glass-chip text-xs px-2.5 py-1 rounded-md flex items-center gap-1"
        >
          {t("notifications.viewDetails")}
          <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export default memo(NotificationItem);
