"use client";

import { useEffect } from "react";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import EmptyState from "@/components/common/EmptyState";
import NotificationList from "@/components/notifications/NotificationList";
import { useI18n } from "@/lib/i18n-context";
import { useGlobalStore } from "@/store/global-store";

interface NotificationsProps {
  isAuthenticated: boolean;
  onOpenLogin: () => void;
  onToggleTheme?: () => void;
}

export default function Notifications({
  isAuthenticated,
  onOpenLogin,
  onToggleTheme = () => {},
}: NotificationsProps) {
  const { t } = useI18n();
  const unreadCount = useGlobalStore((state) => state.unreadCount);
  const notifications = useGlobalStore((state) => state.notifications);
  const loadNotifications = useGlobalStore((state) => state.loadNotifications);
  const refreshUnread = useGlobalStore((state) => state.refreshUnread);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadNotifications();
    refreshUnread();
  }, [isAuthenticated, loadNotifications, refreshUnread]);

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--app-bg)" }}>
      <Header
        isAuthenticated={isAuthenticated}
        onOpenLogin={onOpenLogin}
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
              <div className="glass-panel rounded-2xl p-4 mb-6 flex flex-wrap items-center gap-3">
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
                    {notifications.length}
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

              <NotificationList variant="page" />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
