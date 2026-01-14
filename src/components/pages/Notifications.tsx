"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import EmptyState from "@/components/common/EmptyState";
import NotificationItem from "@/components/notifications/NotificationItem";
import { Button } from "@/components/ui/button";
import { useAPIClient } from "@/lib/use-api-client";
import { useI18n } from "@/lib/i18n-context";
import { useGlobalStore } from "@/store/global-store";
import type { Notification } from "@/types/api";
import { ApiError } from "@/types/api";

interface NotificationsProps {
  isAuthenticated: boolean;
  onOpenLogin: () => void;
  language?: "zh" | "en";
  onToggleLanguage?: () => void;
  onToggleTheme?: () => void;
}

const PAGE_SIZE = 20;

export default function Notifications({
  isAuthenticated,
  onOpenLogin,
  language = "zh",
  onToggleLanguage = () => {},
  onToggleTheme = () => {},
}: NotificationsProps) {
  const client = useAPIClient();
  const { t } = useI18n();
  const unreadCount = useGlobalStore((state) => state.unreadCount);
  const markAsRead = useGlobalStore((state) => state.markAsRead);
  const markAllAsRead = useGlobalStore((state) => state.markAllAsRead);
  const clearNotifications = useGlobalStore((state) => state.clearNotifications);
  const refreshNotificationStats = useGlobalStore(
    (state) => state.refreshNotificationStats
  );

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalAll, setTotalAll] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const totalDisplay = totalAll || 0;

  const hasMore = useMemo(
    () => notifications.length > 0 && notifications.length < total,
    [notifications.length, total]
  );

  const loadNotifications = useCallback(
    async (targetPage: number, append: boolean) => {
      if (!isAuthenticated) return;
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const response = await client.getNotifications({
          page: targetPage,
          page_size: PAGE_SIZE,
          unread_only: unreadOnly || undefined,
        });
        setPage(response.page);
        setTotal(response.total);
        if (!unreadOnly) {
          setTotalAll(response.total);
        }
        setNotifications((prev) => {
          const nextItems = append ? [...prev, ...response.items] : response.items;
          const seen = new Set<string>();
          const deduped: Notification[] = [];
          for (const item of nextItems) {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            deduped.push(item);
          }
          return deduped;
        });
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
          if (err.code >= 40100 && err.code < 40200) {
            onOpenLogin();
          }
        } else {
          setError(err instanceof Error ? err.message : t("notifications.loadFailed"));
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [client, isAuthenticated, onOpenLogin, t, unreadOnly]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setLoading(false);
      setLoadingMore(false);
      setError(null);
      setPage(1);
      setTotal(0);
      setTotalAll(0);
      return;
    }
    loadNotifications(1, false);
  }, [isAuthenticated, loadNotifications]);

  useEffect(() => {
    if (!isAuthenticated) return;
    refreshNotificationStats();
  }, [isAuthenticated, refreshNotificationStats]);

  const handleMarkAsRead = async (id: string) => {
    const target = notifications.find((item) => item.id === id);
    const wasUnread = target ? !target.read_at : false;
    const now = new Date().toISOString();

    setNotifications((prev) => {
      if (unreadOnly) {
        return prev.filter((item) => item.id !== id);
      }
      return prev.map((item) =>
        item.id === id ? { ...item, read_at: now } : item
      );
    });

    if (unreadOnly && wasUnread) {
      setTotal((prev) => Math.max(0, prev - 1));
    }

    await markAsRead(id);
  };

  const handleMarkAllAsRead = async () => {
    const now = new Date().toISOString();
    setNotifications((prev) =>
      unreadOnly ? [] : prev.map((item) => ({ ...item, read_at: item.read_at || now }))
    );
    if (unreadOnly) {
      setTotal(0);
    }
    await markAllAsRead();
  };

  const handleClearAll = async () => {
    setNotifications([]);
    setTotal(0);
    setTotalAll(0);
    await clearNotifications();
  };

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--app-bg)" }}>
      <Header
        isAuthenticated={isAuthenticated}
        onOpenLogin={onOpenLogin}
        language={language}
        onToggleLanguage={onToggleLanguage}
        onToggleTheme={onToggleTheme}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <main
          className="flex-1 overflow-y-auto px-8 py-6"
          style={{ background: "var(--app-bg)" }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-h2" style={{ color: "var(--app-text)" }}>
                {t("notifications.pageTitle")}
              </h2>
              <p className="text-sm" style={{ color: "var(--app-text-muted)" }}>
                {t("notifications.pageSubtitle")}
              </p>
            </div>
          </div>

          {!isAuthenticated ? (
            <EmptyState
              variant="default"
              title={t("notifications.loginRequiredTitle")}
              description={t("notifications.loginRequiredDesc")}
              action={{
                label: t("dashboard.goLogin"),
                onClick: onOpenLogin,
                variant: "primary",
              }}
            />
          ) : (
            <>
              <div className="glass-panel rounded-2xl p-4 mb-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div
                      className="rounded-full px-3 py-1 text-xs border"
                      style={{
                        borderColor: "var(--app-glass-border)",
                        color: "var(--app-text-muted)",
                        background: "var(--app-glass-bg-strong)",
                      }}
                    >
                      {t("notifications.totalLabel")}:{" "}
                      <span className="text-[var(--app-text)] font-semibold">
                        {totalDisplay}
                      </span>
                    </div>
                    <div
                      className="rounded-full px-3 py-1 text-xs border"
                      style={{
                        borderColor: "var(--app-glass-border)",
                        color: "var(--app-text-muted)",
                        background: "var(--app-glass-bg-strong)",
                      }}
                    >
                      {t("notifications.unreadLabel")}:{" "}
                      <span className="text-[var(--app-text)] font-semibold">
                        {unreadCount}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setUnreadOnly(false)}
                      className="glass-chip px-4 py-2 rounded-lg text-sm"
                      data-active={!unreadOnly}
                    >
                      {t("notifications.filterAll")} ({totalAll})
                    </button>
                    <button
                      onClick={() => setUnreadOnly(true)}
                      className="glass-chip px-4 py-2 rounded-lg text-sm"
                      data-active={unreadOnly}
                    >
                      {t("notifications.filterUnread")} ({unreadCount})
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleMarkAllAsRead}
                      disabled={notifications.length === 0 || unreadCount === 0}
                    >
                      {t("notifications.markAllRead")}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleClearAll}
                      disabled={notifications.length === 0}
                    >
                      {t("notifications.clear")}
                    </Button>
                  </div>
                </div>
              </div>

              {error ? (
                <div className="text-sm mb-4" style={{ color: "var(--app-danger)" }}>
                  {error}
                </div>
              ) : null}

              {loading && notifications.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--app-text-muted)" }} />
                </div>
              ) : notifications.length > 0 ? (
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={handleMarkAsRead}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  variant="default"
                  title={t("notifications.emptyTitle")}
                  description={t("notifications.emptyDesc")}
                />
              )}

              {hasMore && (
                <div className="flex justify-center mt-6">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => loadNotifications(page + 1, true)}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
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
            </>
          )}
        </main>
      </div>
    </div>
  );
}
