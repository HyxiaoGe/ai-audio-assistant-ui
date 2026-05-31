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

// audit a11y #15：整行可点击但无 role/tabIndex/键盘处理，键盘与读屏用户不可达。
describe("NotificationItem a11y", () => {
  it("exposes the row as a focusable button named by the title", () => {
    render(<NotificationItem notification={baseNotification} onMarkAsRead={vi.fn()} />);
    const row = screen.getByRole("button", { name: "Task completed" });
    expect(row).toHaveAttribute("tabindex", "0");
  });

  it("activates on Enter and Space from the keyboard", () => {
    const onMarkAsRead = vi.fn();
    render(
      <NotificationItem notification={baseNotification} onMarkAsRead={onMarkAsRead} />
    );
    const row = screen.getByRole("button", { name: "Task completed" });

    fireEvent.keyDown(row, { key: "Enter" });
    expect(onMarkAsRead).toHaveBeenCalledWith("notif-1");
    expect(push).toHaveBeenCalledWith("/tasks/task-1");

    onMarkAsRead.mockClear();
    push.mockClear();
    fireEvent.keyDown(row, { key: " " });
    expect(onMarkAsRead).toHaveBeenCalledWith("notif-1");
  });

  // audit a11y F111：showActions 模式下「查看详情」按钮原本嵌套在 role="button"
  // 整行内，构成 button-in-button 反模式（交互元素嵌套交互元素），读屏语义冲突、
  // Tab 顺序混乱。整行 button 与「查看详情」按钮应为同级关系。
  it("does not nest the view-details button inside the row button", () => {
    render(
      <NotificationItem
        notification={baseNotification}
        onMarkAsRead={vi.fn()}
        showActions
      />
    );
    const row = screen.getByRole("button", { name: "Task completed" });
    const viewDetails = screen.getByRole("button", { name: "View details" });

    expect(row).not.toContainElement(viewDetails);
  });
});
