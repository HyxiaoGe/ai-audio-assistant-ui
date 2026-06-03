import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NotificationPanel from "@/components/notifications/NotificationPanel";
import { useGlobalStore } from "@/store/global-store";
import type { Notification } from "@/types/api";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({
    locale: "en",
    t: (key: string) => {
      const map: Record<string, string> = {
        "notifications.title": "Notifications",
        "notifications.viewAll": "View all",
        "notifications.clear": "Clear",
        "notifications.empty": "No notifications yet",
        "common.justNow": "just now",
        "notif.task_completed.title": "Task completed",
        "notif.task_completed.body": "task is ready",
      };
      return map[key] ?? key;
    },
  }),
}));

const markAllAsRead = vi.fn();

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
  markAllAsRead.mockReset();
  useGlobalStore.setState({
    notifications: [makeNotif("n1")],
    unreadCount: 1,
    notificationsLoaded: true,
    notificationsLoading: false,
    notificationsError: null,
    notificationsHasMore: false,
    markAsRead: vi.fn(),
    markAllAsRead,
    loadNotifications: vi.fn(),
  });
});

describe("NotificationPanel", () => {
  it("'清空' button triggers markAllAsRead (not delete)", () => {
    render(<NotificationPanel />);
    fireEvent.click(screen.getByText("Clear"));
    expect(markAllAsRead).toHaveBeenCalledTimes(1);
  });

  it("renders the shared list (panel variant)", () => {
    render(<NotificationPanel />);
    expect(
      screen.getByRole("button", { name: "Task completed" })
    ).toBeInTheDocument();
  });
});
