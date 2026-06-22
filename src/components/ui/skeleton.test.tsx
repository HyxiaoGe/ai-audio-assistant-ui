import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "./skeleton";

describe("Skeleton 基元", () => {
  it("渲染 data-slot=skeleton 且含 animate-pulse 与玻璃 token 填充", () => {
    render(<Skeleton data-testid="sk" />);
    const el = screen.getByTestId("sk");
    expect(el).toHaveAttribute("data-slot", "skeleton");
    expect(el.className).toContain("animate-pulse");
    expect(el.className).toContain("bg-[var(--app-skeleton)]");
  });

  it("透传自定义 className 且对屏幕阅读器隐藏", () => {
    render(<Skeleton data-testid="sk" className="h-4 w-40" />);
    const el = screen.getByTestId("sk");
    expect(el.className).toContain("h-4");
    expect(el.className).toContain("w-40");
    expect(el).toHaveAttribute("aria-hidden", "true");
  });
});
