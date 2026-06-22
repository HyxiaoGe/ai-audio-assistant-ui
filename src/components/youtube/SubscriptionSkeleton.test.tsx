import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// t 直接回 key,便于断言 sr-only 文案。
vi.mock("@/lib/i18n-context", () => ({ useI18n: () => ({ locale: "zh", t: (k: string) => k }) }));

import { ChannelListSkeleton, VideoGridSkeleton } from "./SubscriptionSkeleton";

describe("ChannelListSkeleton", () => {
  it("默认渲染 6 个频道骨架卡", () => {
    render(<ChannelListSkeleton />);
    expect(screen.getAllByTestId("channel-card-skeleton")).toHaveLength(6);
  });

  it("count 可控制卡片数量", () => {
    render(<ChannelListSkeleton count={3} />);
    expect(screen.getAllByTestId("channel-card-skeleton")).toHaveLength(3);
  });

  it("外层是 role=status 并含 sr-only 加载文案", () => {
    render(<ChannelListSkeleton />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });
});

describe("VideoGridSkeleton", () => {
  it("默认渲染 8 个视频骨架卡", () => {
    render(<VideoGridSkeleton />);
    expect(screen.getAllByTestId("video-card-skeleton")).toHaveLength(8);
  });

  it("count 可控制卡片数量", () => {
    render(<VideoGridSkeleton count={4} />);
    expect(screen.getAllByTestId("video-card-skeleton")).toHaveLength(4);
  });

  it("外层是 role=status 并含 sr-only 加载文案", () => {
    render(<VideoGridSkeleton />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });
});
