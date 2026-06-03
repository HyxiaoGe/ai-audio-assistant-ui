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
      if (key === "notifications.viewDetails") return "View details";
      if (key === "notif.task_completed.title") return "Task completed";
      if (key === "notif.task_completed.body")
        return `"${vars?.task_title}" is ready`;
      if (key === "notif.task_failed.title") return "Task failed";
      if (key === "notif.task_failed.body") return "It failed";
      return key;
    },
  }),
}));

const completed: Notification = {
  id: "notif-1",
  type: "task_completed",
  category: "task",
  priority: "normal",
  params: { task_title: "My meeting" },
  action_url: "/tasks/task-1",
  title: null,
  message: null,
  read_at: null,
  created_at: new Date().toISOString(),
};

afterEach(() => {
  push.mockReset();
});

describe("NotificationItem (type + params)", () => {
  it("renders title and body from type+params via t()", () => {
    render(<NotificationItem notification={completed} />);
    expect(screen.getByText("Task completed")).toBeInTheDocument();
    expect(screen.getByText('"My meeting" is ready')).toBeInTheDocument();
  });

  it("falls back to title/message when the type key is missing", () => {
    const unknown: Notification = {
      ...completed,
      type: "mystery_type",
      title: "Raw title",
      message: "Raw message",
    };
    render(<NotificationItem notification={unknown} />);
    expect(screen.getByText("Raw title")).toBeInTheDocument();
    expect(screen.getByText("Raw message")).toBeInTheDocument();
  });

  it("uses error styling for task_failed type", () => {
    const failed: Notification = {
      ...completed,
      id: "notif-2",
      type: "task_failed",
    };
    const { container } = render(<NotificationItem notification={failed} />);
    expect(container.querySelector(".text-red-500")).toBeTruthy();
  });

  it("single click marks read and navigates on the page surface", () => {
    const onMarkAsRead = vi.fn();
    render(
      <NotificationItem notification={completed} onMarkAsRead={onMarkAsRead} />
    );
    fireEvent.click(screen.getByText("Task completed"));
    expect(onMarkAsRead).toHaveBeenCalledWith("notif-1");
    expect(push).toHaveBeenCalledWith("/tasks/task-1");
  });

  it("single click marks read AND navigates on the panel surface too", () => {
    const onMarkAsRead = vi.fn();
    render(
      <NotificationItem
        notification={completed}
        onMarkAsRead={onMarkAsRead}
        showActions
      />
    );
    fireEvent.click(screen.getByText("Task completed"));
    expect(onMarkAsRead).toHaveBeenCalledWith("notif-1");
    expect(push).toHaveBeenCalledWith("/tasks/task-1");
  });
});
