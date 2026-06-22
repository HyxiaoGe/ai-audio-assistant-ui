import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Notifications from "@/components/pages/Notifications";
import { useGlobalStore } from "@/store/global-store";
import type { Notification } from "@/types/api";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
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

const authState = vi.hoisted(() => ({ user: { id: "u1" } as { id: string } | null }));
vi.mock("@/store/auth-store", () => ({
  useAuthStore: (sel: (s: { user: { id: string } | null }) => unknown) => sel({ user: authState.user }),
}));
vi.mock("@/store/ui-store", () => ({
  useUIStore: (sel: (s: { openLogin: () => void; openNewTask: () => void }) => unknown) =>
    sel({ openLogin: vi.fn(), openNewTask: vi.fn() }),
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
  authState.user = { id: "u1" };
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
    const { container } = render(<Notifications />);
    expect(loadNotifications).toHaveBeenCalledTimes(1);
    expect(refreshUnread).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".h-screen")).toBeNull();
  });

  it("renders the shared list reading the same store", () => {
    render(<Notifications />);
    expect(
      screen.getByRole("button", { name: "Task completed" })
    ).toBeInTheDocument();
  });

  it("does not fetch when unauthenticated", () => {
    authState.user = null;
    render(<Notifications />);
    expect(loadNotifications).not.toHaveBeenCalled();
  });
});
