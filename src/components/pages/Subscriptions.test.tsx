import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReadonlyURLSearchParams } from "next/navigation";

// ---- mocks(全部 hoist 到模块顶层)----
const mockClient = vi.hoisted(() => ({
  getYouTubeStatus: vi.fn(),
  getYouTubeSyncOverview: vi.fn(),
  getYouTubeSubscriptions: vi.fn(),
  getYouTubeLatestVideos: vi.fn(),
  getYouTubeStarredVideos: vi.fn(),
  getYouTubeChannelVideos: vi.fn(),
  prewarmYouTubeSummaryStyleRecommendations: vi.fn(),
}));

vi.mock("@/lib/use-api-client", () => ({ useAPIClient: () => mockClient }));
vi.mock("@/lib/i18n-context", () => ({ useI18n: () => ({ locale: "zh", t: (k: string) => k }) }));
vi.mock("@/lib/use-date-formatter", () => ({
  useDateFormatter: () => ({ formatRelativeTime: () => "1 天前" }),
}));
vi.mock("@/lib/notify", () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/store/auth-store", () => ({
  useAuthStore: (sel: (s: { user: { id: string } | null }) => unknown) => sel({ user: { id: "u1" } }),
}));
vi.mock("@/store/ui-store", () => ({
  useUIStore: (sel: (s: { openLogin: () => void; openNewTask: () => void }) => unknown) =>
    sel({ openLogin: vi.fn(), openNewTask: vi.fn() }),
}));
// 子组件 stub:VideoCard 渲染 null;ChannelCard 渲染可点按钮以触发 onSelect;搜索框 null。
vi.mock("@/components/youtube/VideoCard", () => ({ default: () => null }));
vi.mock("@/components/youtube/ChannelCard", () => ({
  ChannelCard: ({
    channel,
    onSelect,
  }: {
    channel: { channel_id: string; channel_title: string };
    onSelect: (c: { channel_id: string; channel_title: string }) => void;
  }) => (
    <button data-testid="channel-card-stub" onClick={() => onSelect(channel)}>
      {channel.channel_title}
    </button>
  ),
}));
vi.mock("@/components/youtube/ChannelSearchInput", () => ({ ChannelSearchInput: () => null }));

import Subscriptions from "./Subscriptions";

const PENDING = () => new Promise<never>(() => {});
const emptyPage = { items: [], total: 0, page: 1, page_size: 12 };

function renderPage() {
  return render(
    <Subscriptions searchParams={new URLSearchParams() as unknown as ReadonlyURLSearchParams} />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom 未实现 scrollIntoView,handleChannelClick 的 setTimeout 会调用它;stub 掉避免噪声。
  Element.prototype.scrollIntoView = vi.fn();
  // 默认:已连接,各列表解析为空页,sync overview 永挂(可选,保持 null)。
  mockClient.getYouTubeStatus.mockResolvedValue({
    connected: true,
    subscription_count: 0,
    needs_reauth: false,
  });
  mockClient.getYouTubeSyncOverview.mockImplementation(PENDING);
  mockClient.getYouTubeSubscriptions.mockResolvedValue({ ...emptyPage, page_size: 20 });
  mockClient.getYouTubeLatestVideos.mockResolvedValue({ ...emptyPage });
  mockClient.getYouTubeStarredVideos.mockResolvedValue({ ...emptyPage });
  mockClient.getYouTubeChannelVideos.mockImplementation(PENDING);
  mockClient.prewarmYouTubeSummaryStyleRecommendations.mockResolvedValue(undefined);
});

describe("Subscriptions 最新视频加载/错误态", () => {
  it("最新视频首屏加载显示视频骨架", async () => {
    mockClient.getYouTubeLatestVideos.mockImplementation(PENDING); // 永挂 → loading 保持 true
    renderPage();
    // latest 是默认激活 tab,无需切换。
    expect((await screen.findAllByTestId("video-card-skeleton")).length).toBeGreaterThan(0);
  });

  it("最新视频加载失败显示 ErrorState 并可重试", async () => {
    mockClient.getYouTubeLatestVideos.mockRejectedValue(new Error("boom"));
    renderPage();
    const retry = await screen.findByText("common.retry");
    const before = mockClient.getYouTubeLatestVideos.mock.calls.length;
    fireEvent.click(retry);
    await waitFor(() =>
      expect(mockClient.getYouTubeLatestVideos.mock.calls.length).toBeGreaterThan(before)
    );
  });
});
