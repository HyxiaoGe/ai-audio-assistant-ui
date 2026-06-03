import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Notifications from "@/components/pages/Notifications";
import { useGlobalStore } from "@/store/global-store";
import type { Notification } from "@/types/api";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/layout/Header", () => ({ default: () => <div /> }));
vi.mock("@/components/layout/Sidebar", () => ({ default: () => <div /> }));
vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({
    locale: "en",
    t: (key: string) => {
      const map: Record<string, string> = {
        "notifications.pageTitle": "Notifications",
        "notifications.emptyTitle": "No notifications",
        "common.justNow": "just now",
        "notif.task_completed.title": "Task completed",
        "notif.task_completed.body": "task is ready",
      };
      return map[key] ?? key;
    },
  }),
}));

const loadNotifications = vi.fn();
const refreshUnread = vi.fn();

function makeNotif(id: string): Notification {
  return {
    id,
    type: "task_completed",
    category: "task",
    priority: "normal",
    params: { task_title: "T" },
    action_url: `/tasks/${id}`,
    title: null,
    message: null,
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

beforeEach(() => {
  loadNotifications.mockReset();
  refreshUnread.mockReset();
  useGlobalStore.setState({
    notifications: [makeNotif("n1")],
    unreadCount: 1,
    notificationsLoaded: true,
    notificationsLoading: false,
    notificationsError: null,
    notificationsHasMore: false,
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    loadNotifications,
    refreshUnread,
  });
});

describe("Notifications page", () => {
  it("loads notifications and refreshes unread on mount when authenticated", () => {
    render(<Notifications isAuthenticated onOpenLogin={vi.fn()} />);
    expect(loadNotifications).toHaveBeenCalledTimes(1);
    expect(refreshUnread).toHaveBeenCalledTimes(1);
  });

  it("renders the shared list reading the same store", () => {
    render(<Notifications isAuthenticated onOpenLogin={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Task completed" })
    ).toBeInTheDocument();
  });

  it("does not fetch when unauthenticated", () => {
    render(<Notifications isAuthenticated={false} onOpenLogin={vi.fn()} />);
    expect(loadNotifications).not.toHaveBeenCalled();
  });
});
