import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NotificationItem from "@/components/notifications/NotificationItem";
import type { Notification } from "@/types/api";
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({
    locale: "en",
    t: (key: string, vars?: Record<string, string | number>) => {
      if (key === "common.justNow") return "just now";
      if (key === "time.minutes") return `${vars?.count} min`;
      if (key === "time.hours") return `${vars?.count} hr`;
      if (key === "notifications.viewDetails") return "View details";
      return key;
    },
  }),
}));

const baseNotification: Notification = {
  id: "notif-1",
  user_id: "user-1",
  task_id: "task-1",
  category: "task",
  action: "completed",
  title: "Task completed",
  message: "Your task is ready",
  action_url: "/tasks/task-1",
  read_at: null,
  dismissed_at: null,
  extra_data: {},
  priority: "normal",
  expires_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

afterEach(() => {
  push.mockReset();
});

describe("NotificationItem", () => {
  it("renders title and relative time", () => {
    render(<NotificationItem notification={baseNotification} />);

    expect(screen.getByText("Task completed")).toBeInTheDocument();
    expect(screen.getByText("just now")).toBeInTheDocument();
  });

  it("marks as read and navigates on item click by default", () => {
    const onMarkAsRead = vi.fn();
    render(
      <NotificationItem
        notification={baseNotification}
        onMarkAsRead={onMarkAsRead}
      />
    );

    fireEvent.click(screen.getByText("Task completed"));

    expect(onMarkAsRead).toHaveBeenCalledWith("notif-1");
    expect(push).toHaveBeenCalledWith("/tasks/task-1");
  });

  it("only marks as read on item click when actions are shown", () => {
    const onMarkAsRead = vi.fn();
    render(
      <NotificationItem
        notification={baseNotification}
        onMarkAsRead={onMarkAsRead}
        showActions
      />
    );

    fireEvent.click(screen.getByText("Task completed"));

    expect(onMarkAsRead).toHaveBeenCalledWith("notif-1");
    expect(push).not.toHaveBeenCalled();
  });

  it("navigates via view details when actions are shown", () => {
    const onMarkAsRead = vi.fn();
    render(
      <NotificationItem
        notification={baseNotification}
        onMarkAsRead={onMarkAsRead}
        showActions
      />
    );

    fireEvent.click(screen.getByText("View details"));

    expect(onMarkAsRead).toHaveBeenCalledWith("notif-1");
    expect(push).toHaveBeenCalledWith("/tasks/task-1");
  });
});
