"use client";

import { Bell, Loader2 } from "lucide-react";
import { useGlobalStore } from "@/store/global-store";
import { useI18n } from "@/lib/i18n-context";
import { Button } from "@/components/ui/button";
import NotificationItem from "./NotificationItem";

interface NotificationListProps {
  variant: "panel" | "page";
  onItemActivate?: () => void;
}

const PANEL_LIMIT = 10;

export default function NotificationList({
  variant,
  onItemActivate,
}: NotificationListProps) {
  const { t } = useI18n();
  const notifications = useGlobalStore((s) => s.notifications);
  const loading = useGlobalStore((s) => s.notificationsLoading);
  const loaded = useGlobalStore((s) => s.notificationsLoaded);
  const error = useGlobalStore((s) => s.notificationsError);
  const hasMore = useGlobalStore((s) => s.notificationsHasMore);
  const markAsRead = useGlobalStore((s) => s.markAsRead);
  const markAllAsRead = useGlobalStore((s) => s.markAllAsRead);
  const loadNotifications = useGlobalStore((s) => s.loadNotifications);

  const items =
    variant === "panel" ? notifications.slice(0, PANEL_LIMIT) : notifications;

  const handleMarkAsRead = (id: string) => {
    markAsRead(id);
    onItemActivate?.();
  };

  if (loading && !loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2
          className="w-5 h-5 animate-spin"
          style={{ color: "var(--app-text-muted)" }}
          aria-label="loading"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm" style={{ color: "var(--app-danger)" }}>
          {error}
        </p>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => loadNotifications()}
        >
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {variant === "panel"
            ? t("notifications.empty")
            : t("notifications.emptyTitle")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className={variant === "panel" ? "space-y-2" : "space-y-3"}>
        {items.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onMarkAsRead={handleMarkAsRead}
          />
        ))}
      </div>

      {variant === "panel" && (
        <div className="pt-3 mt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => markAllAsRead()}
            className="w-full text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            {t("notifications.clear")}
          </button>
        </div>
      )}

      {variant === "page" && hasMore && (
        <div className="flex justify-center mt-6">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadNotifications({ append: true })}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("notifications.loadingMore")}
              </>
            ) : (
              t("notifications.loadMore")
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
