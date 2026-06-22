import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n-context", () => ({ useI18n: () => ({ t: (k: string) => k }) }));

import PublicTaskCardSkeleton from "./PublicTaskCardSkeleton";

describe("PublicTaskCardSkeleton", () => {
  it("默认渲染 5 个公开卡骨架", () => {
    render(<PublicTaskCardSkeleton />);
    expect(screen.getAllByTestId("public-task-card-skeleton")).toHaveLength(5);
  });

  it("按 count 渲染指定数量", () => {
    render(<PublicTaskCardSkeleton count={3} />);
    expect(screen.getAllByTestId("public-task-card-skeleton")).toHaveLength(3);
  });

  it("容器声明加载语义", () => {
    render(<PublicTaskCardSkeleton count={1} />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("common.loading");
  });
});
