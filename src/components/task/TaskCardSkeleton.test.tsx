import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n-context", () => ({ useI18n: () => ({ t: (k: string) => k }) }));

import TaskCardSkeleton from "./TaskCardSkeleton";

describe("TaskCardSkeleton", () => {
  it("默认渲染 6 个卡片骨架", () => {
    render(<TaskCardSkeleton />);
    expect(screen.getAllByTestId("task-card-skeleton")).toHaveLength(6);
  });

  it("按 count 渲染指定数量", () => {
    render(<TaskCardSkeleton count={4} />);
    expect(screen.getAllByTestId("task-card-skeleton")).toHaveLength(4);
  });

  it("容器声明加载语义供屏幕阅读器播报", () => {
    render(<TaskCardSkeleton count={1} />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("common.loading");
  });
});
