import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NotificationList from "@/components/notifications/NotificationList";
import { useGlobalStore } from "@/store/global-store";
import type { Notification } from "@/types/api";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({
    locale: "en",
    t: (key: string) => {
      const map: Record<string, string> = {
        "notifications.empty": "No notifications yet",
        "notifications.emptyTitle": "No notifications",
        "notifications.loadFailed": "Failed to load notifications",
        "notifications.markAllRead": "Mark all read",
        "notifications.clear": "Clear",
        "notifications.loadMore": "Load more",
        "common.justNow": "just now",
        "notif.task_completed.title": "Task completed",
        "notif.task_completed.body": "task is ready",
      };
      return map[key] ?? key;
    },
  }),
}));

const markAllAsRead = vi.fn();
const loadNotifications = vi.fn();

function makeNotif(id: string, read = false): Notification {
  return {
    id,
    type: "task_completed",
    category: "task",
    priority: "normal",
    params: { task_title: "T" },
    action_url: `/tasks/${id}`,
    title: null,
    message: null,
    read_at: read ? new Date().toISOString() : null,
    created_at: new Date().toISOString(),
  };
}

beforeEach(() => {
  markAllAsRead.mockReset();
  loadNotifications.mockReset();
  useGlobalStore.setState({
    notifications: [],
    unreadCount: 0,
    notificationsLoaded: true,
    notificationsLoading: false,
    notificationsError: null,
    notificationsHasMore: false,
    markAsRead: vi.fn(),
    markAllAsRead,
    loadNotifications,
  });
});

describe("NotificationList", () => {
  it("shows loading state when loading and empty (page)", () => {
    useGlobalStore.setState({ notificationsLoading: true, notificationsLoaded: false });
    const { container } = render(<NotificationList variant="page" />);
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("shows error state when notificationsError is set", () => {
    useGlobalStore.setState({ notificationsError: "boom" });
    render(<NotificationList variant="page" />);
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("shows empty state when no notifications", () => {
    render(<NotificationList variant="panel" />);
    expect(screen.getByText("No notifications yet")).toBeInTheDocument();
  });

  it("renders at most 10 items in panel variant", () => {
    useGlobalStore.setState({
      notifications: Array.from({ length: 15 }, (_, i) => makeNotif(`n${i}`)),
    });
    render(<NotificationList variant="panel" />);
    expect(screen.getAllByRole("button", { name: "Task completed" })).toHaveLength(10);
  });

  it("renders all items in page variant", () => {
    useGlobalStore.setState({
      notifications: Array.from({ length: 15 }, (_, i) => makeNotif(`n${i}`)),
    });
    render(<NotificationList variant="page" />);
    expect(screen.getAllByRole("button", { name: "Task completed" })).toHaveLength(15);
  });

  it("panel '清空' calls markAllAsRead, NOT a delete", () => {
    useGlobalStore.setState({ notifications: [makeNotif("n1")] });
    render(<NotificationList variant="panel" />);
    fireEvent.click(screen.getByText("Clear"));
    expect(markAllAsRead).toHaveBeenCalledTimes(1);
  });

  it("page 'load more' appends next page", () => {
    useGlobalStore.setState({
      notifications: [makeNotif("n1")],
      notificationsHasMore: true,
    });
    render(<NotificationList variant="page" />);
    fireEvent.click(screen.getByText("Load more"));
    expect(loadNotifications).toHaveBeenCalledWith({ append: true });
  });
});
