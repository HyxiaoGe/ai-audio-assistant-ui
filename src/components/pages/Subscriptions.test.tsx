import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
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
// 生产里 Radix Tabs 默认懒挂(非激活 tab 内容不挂载),保留这点对生产是对的:
// 避免未打开的 tab 提前渲染 VideoCard 及其缩略图。但 Radix Presence 依赖
// animation/transition 事件,在 jsdom 里切 tab 不可靠挂载内容。为在测试里直达每个
// 列表的加载/错误分支,这里把 tabs 原语 stub 成始终渲染全部内容(纯测试侧,不动生产)。
// TabsTrigger 保留 role="tab" 以兼容既有按名查询。各用例只让被测列表 pending/reject,
// 其余默认解析为空页,故同名骨架/重试按钮只来自被测列表。
vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children?: ReactNode }) => <button role="tab">{children}</button>,
  TabsContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

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

describe("Subscriptions 收藏视频加载/错误态", () => {
  // tabs 已 stub 成全渲染:只让 starred pending/reject,latest/channels 默认空页,
  // 故下面匹配到的视频骨架/重试按钮唯一来自收藏列表。
  it("收藏列表首屏加载显示视频骨架", async () => {
    mockClient.getYouTubeStarredVideos.mockImplementation(PENDING);
    renderPage();
    expect((await screen.findAllByTestId("video-card-skeleton")).length).toBeGreaterThan(0);
  });

  it("收藏列表加载失败显示 ErrorState 并可重试", async () => {
    mockClient.getYouTubeStarredVideos.mockRejectedValue(new Error("boom"));
    renderPage();
    const retry = await screen.findByText("common.retry");
    const before = mockClient.getYouTubeStarredVideos.mock.calls.length;
    fireEvent.click(retry);
    await waitFor(() =>
      expect(mockClient.getYouTubeStarredVideos.mock.calls.length).toBeGreaterThan(before)
    );
  });
});

describe("Subscriptions 频道列表加载/错误态", () => {
  it("频道列表首屏加载显示频道骨架", async () => {
    mockClient.getYouTubeSubscriptions.mockImplementation(PENDING);
    renderPage();
    expect((await screen.findAllByTestId("channel-card-skeleton")).length).toBeGreaterThan(0);
  });

  it("频道列表加载失败显示 ErrorState 并可重试", async () => {
    mockClient.getYouTubeSubscriptions.mockRejectedValue(new Error("boom"));
    renderPage();
    const retry = await screen.findByText("common.retry");
    const before = mockClient.getYouTubeSubscriptions.mock.calls.length;
    fireEvent.click(retry);
    await waitFor(() =>
      expect(mockClient.getYouTubeSubscriptions.mock.calls.length).toBeGreaterThan(before)
    );
  });
});
