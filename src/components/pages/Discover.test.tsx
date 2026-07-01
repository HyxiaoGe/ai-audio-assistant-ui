import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError, ErrorCode } from "@/types/api"

// jsdom 无 IntersectionObserver:本地可控 stub,捕获实例以手动模拟「滚到底」。
const ioInstances: Array<{ trigger: () => void }> = []
class MockIO {
  constructor(private cb: IntersectionObserverCallback) {
    ioInstances.push({
      trigger: () => this.cb([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver),
    })
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("IntersectionObserver", MockIO)

const i18n = vi.hoisted(() => ({ t: (k: string) => k }))
const stores = vi.hoisted(() => ({ authed: true, openLogin: vi.fn(), openNewTask: vi.fn() }))
const client = vi.hoisted(() => ({ searchYouTube: vi.fn(), getYouTubeTrending: vi.fn(), getRecommendations: vi.fn() }))

vi.mock("@/lib/i18n-context", () => ({ useI18n: () => ({ t: i18n.t, locale: "en" }) }))
vi.mock("@/lib/use-api-client", () => ({ useAPIClient: () => client }))
vi.mock("@/store/auth-store", () => ({
  useAuthStore: (sel: (s: { user: unknown }) => unknown) =>
    sel({ user: stores.authed ? { id: "u1" } : null }),
}))
vi.mock("@/store/ui-store", () => ({
  useUIStore: (sel: (s: { openLogin: () => void; openNewTask: (i?: unknown) => void }) => unknown) =>
    sel({ openLogin: stores.openLogin, openNewTask: stores.openNewTask }),
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))

import Discover from "./Discover"
import { useDiscoverStore } from "@/store/discover-store"

function hit(vid: string, title: string) {
  return { video_id: vid, title, channel: null, channel_id: null, thumbnail: null, url: `https://www.youtube.com/watch?v=${vid}` }
}

beforeEach(() => {
  vi.clearAllMocks()
  stores.authed = true
  client.getYouTubeTrending.mockResolvedValue({ items: [] })
  client.getRecommendations.mockResolvedValue({ query: "", cached: false, items: [] })
  useDiscoverStore.getState().reset() // 模块单例 store 跨用例残留,逐例清零
  window.history.replaceState(null, "", "/discover") // jsdom location 跨用例残留,逐例清零
  ioInstances.length = 0
})

describe("Discover trending", () => {
  it("renders trending chips from initialTrending and searches on chip click", async () => {
    client.searchYouTube.mockResolvedValue({ query: "news", cached: true, items: [] })
    render(<Discover initialTrending={[{ query: "news", count: 9 }, { query: "music", count: 4 }]} />)
    expect(screen.getByText("discover.trendingLabel")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "news" }))
    await waitFor(() => expect(client.searchYouTube).toHaveBeenCalledWith("news", { limit: 50, authenticated: true }))
  })

  it("does not render the trending block when there are no trending items", () => {
    render(<Discover initialTrending={[]} />)
    expect(screen.queryByText("discover.trendingLabel")).toBeNull()
  })
})

describe("Discover", () => {
  it("searches and renders a VideoCard per hit", async () => {
    client.searchYouTube.mockResolvedValue({ query: "cats", cached: false, items: [hit("v1", "Cat 1"), hit("v2", "Cat 2")] })
    render(<Discover />)
    fireEvent.change(screen.getByLabelText("discover.searchPlaceholder"), { target: { value: "cats" } })
    fireEvent.click(screen.getByRole("button", { name: "discover.searchButton" }))
    await waitFor(() => expect(screen.getByText("Cat 1")).toBeInTheDocument())
    expect(screen.getByText("Cat 2")).toBeInTheDocument()
    expect(client.searchYouTube).toHaveBeenCalledWith("cats", { limit: 50, authenticated: true })
  })

  it("搜索后把搜索词写进 URL ?q=", async () => {
    client.searchYouTube.mockResolvedValue({ query: "cats", cached: false, items: [hit("v1", "Cat 1")] })
    render(<Discover />)
    fireEvent.change(screen.getByLabelText("discover.searchPlaceholder"), { target: { value: "cats" } })
    fireEvent.click(screen.getByRole("button", { name: "discover.searchButton" }))
    await waitFor(() => expect(screen.getByText("Cat 1")).toBeInTheDocument())
    expect(window.location.search).toBe("?q=cats")
  })

  it("带 ?q= 进入(分享链接/刷新):挂载即自动搜索并还原搜索框", async () => {
    window.history.replaceState(null, "", "/discover?q=dogs")
    client.searchYouTube.mockResolvedValue({ query: "dogs", cached: true, items: [hit("v9", "Dog 9")] })
    render(<Discover />)
    await waitFor(() => expect(client.searchYouTube).toHaveBeenCalledWith("dogs", { limit: 50, authenticated: true }))
    expect(await screen.findByText("Dog 9")).toBeInTheDocument()
    expect((screen.getByLabelText("discover.searchPlaceholder") as HTMLInputElement).value).toBe("dogs")
  })

  it("切走再切回:还原上一次搜索词与结果,不重新请求", async () => {
    client.searchYouTube.mockResolvedValue({ query: "cats", cached: false, items: [hit("v1", "Cat 1")] })
    const { unmount } = render(<Discover />)
    fireEvent.change(screen.getByLabelText("discover.searchPlaceholder"), { target: { value: "cats" } })
    fireEvent.click(screen.getByRole("button", { name: "discover.searchButton" }))
    await waitFor(() => expect(screen.getByText("Cat 1")).toBeInTheDocument())
    expect(client.searchYouTube).toHaveBeenCalledTimes(1)

    unmount() // 模拟侧栏切走
    client.searchYouTube.mockClear()
    render(<Discover />) // 切回

    expect(screen.getByText("Cat 1")).toBeInTheDocument() // 结果即时还原
    expect((screen.getByLabelText("discover.searchPlaceholder") as HTMLInputElement).value).toBe("cats")
    expect(client.searchYouTube).not.toHaveBeenCalled() // 零网络
  })

  it("搜索进行中展示骨架屏,出结果后骨架消失", async () => {
    let resolveSearch: (v: unknown) => void = () => {}
    client.searchYouTube.mockReturnValue(new Promise((r) => { resolveSearch = r }))
    render(<Discover />)
    fireEvent.change(screen.getByLabelText("discover.searchPlaceholder"), { target: { value: "cats" } })
    fireEvent.click(screen.getByRole("button", { name: "discover.searchButton" }))

    // 加载中:骨架卡出现
    await waitFor(() => expect(screen.getAllByTestId("video-card-skeleton").length).toBeGreaterThan(0))

    await act(async () => {
      resolveSearch({ query: "cats", cached: false, items: [hit("v1", "Cat 1")] })
    })
    // 出结果:骨架消失、卡片在
    await waitFor(() => expect(screen.getByText("Cat 1")).toBeInTheDocument())
    expect(screen.queryByTestId("video-card-skeleton")).toBeNull()
  })

  it("结果超一屏:先渲染 20 条,滚到底再揭示下一批(无限滚动)", async () => {
    const many = Array.from({ length: 50 }, (_, i) => hit(`v${i}`, `Vid ${i}`))
    client.searchYouTube.mockResolvedValue({ query: "many", cached: false, items: many })
    render(<Discover />)
    fireEvent.change(screen.getByLabelText("discover.searchPlaceholder"), { target: { value: "many" } })
    fireEvent.click(screen.getByRole("button", { name: "discover.searchButton" }))
    await waitFor(() => expect(screen.getByText("Vid 0")).toBeInTheDocument())

    // 首屏只渲染前 20 条
    expect(screen.getByText("Vid 19")).toBeInTheDocument()
    expect(screen.queryByText("Vid 20")).toBeNull()
    expect(client.searchYouTube).toHaveBeenCalledWith("many", { limit: 50, authenticated: true })

    // 模拟哨兵进入视口 → 揭示下一批
    // 哨兵 observer 在 effect 里注册,CI(Windows/全量套件较慢)下未必在此同步就绪 →
    // 先 await 等 ioInstances 非空再 trigger,消除 `[-1]` 读到 undefined 的竞态 flake。
    await waitFor(() => expect(ioInstances.length).toBeGreaterThan(0))
    act(() => ioInstances[ioInstances.length - 1].trigger())
    await waitFor(() => expect(screen.getByText("Vid 20")).toBeInTheDocument())
    expect(screen.getByText("Vid 39")).toBeInTheDocument()
    expect(screen.queryByText("Vid 40")).toBeNull()
  })

  it("logged-in transcribe opens new-task modal with the watch URL", async () => {
    client.searchYouTube.mockResolvedValue({ query: "cats", cached: false, items: [hit("v1", "Cat 1")] })
    render(<Discover />)
    fireEvent.change(screen.getByLabelText("discover.searchPlaceholder"), { target: { value: "cats" } })
    fireEvent.click(screen.getByRole("button", { name: "discover.searchButton" }))
    await waitFor(() => expect(screen.getByText("Cat 1")).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "subscriptions.transcribeButton" }))
    expect(stores.openNewTask).toHaveBeenCalledWith({
      initialVideoUrl: "https://www.youtube.com/watch?v=v1",
      initialYouTubeVideoId: "v1",
    })
    expect(stores.openLogin).not.toHaveBeenCalled()
  })

  it("anonymous transcribe opens login, not new-task", async () => {
    stores.authed = false
    client.searchYouTube.mockResolvedValue({ query: "cats", cached: false, items: [hit("v1", "Cat 1")] })
    render(<Discover />)
    fireEvent.change(screen.getByLabelText("discover.searchPlaceholder"), { target: { value: "cats" } })
    fireEvent.click(screen.getByRole("button", { name: "discover.searchButton" }))
    await waitFor(() => expect(screen.getByText("Cat 1")).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "subscriptions.transcribeButton" }))
    expect(stores.openLogin).toHaveBeenCalled()
    expect(stores.openNewTask).not.toHaveBeenCalled()
  })

  it("搜索返回 DISCOVER_DISABLED → 渲染维护页", async () => {
    client.getYouTubeTrending.mockResolvedValue({ items: [] })
    client.searchYouTube.mockRejectedValue(new ApiError(ErrorCode.DISCOVER_DISABLED, "off", "t"))
    render(<Discover />)
    fireEvent.change(screen.getByLabelText("discover.searchPlaceholder"), { target: { value: "x" } })
    fireEvent.click(screen.getByRole("button", { name: "discover.searchButton" }))
    await waitFor(() => expect(screen.getByText("discover.unavailableTitle")).toBeInTheDocument())
  })

  it("热门词返回 DISCOVER_DISABLED → 渲染维护页", async () => {
    client.getYouTubeTrending.mockRejectedValue(new ApiError(ErrorCode.DISCOVER_DISABLED, "off", "t"))
    render(<Discover />)
    await waitFor(() => expect(screen.getByText("discover.unavailableTitle")).toBeInTheDocument())
  })
})

describe("Discover search view count", () => {
  it("passes a search hit's view_count through hitToVideoItem to the card", async () => {
    client.searchYouTube.mockResolvedValue({
      query: "cats",
      cached: false,
      items: [{ ...hit("v1", "Cat"), view_count: 8000 }],
    })
    render(<Discover />)
    fireEvent.change(screen.getByLabelText("discover.searchPlaceholder"), { target: { value: "cats" } })
    fireEvent.click(screen.getByRole("button", { name: "discover.searchButton" }))
    await waitFor(() => expect(screen.getByText("subscriptions.videoViews")).toBeInTheDocument())
  })
})

describe("Discover recommendations", () => {
  it("renders 热门推荐 grid from initialRecommendations before searching", () => {
    render(
      <Discover
        initialRecommendations={[hit("r1", "Rec One"), hit("r2", "Rec Two")]}
      />,
    )
    expect(screen.getByText("discover.recommendationsTitle")).toBeInTheDocument()
    expect(screen.getByText("Rec One")).toBeInTheDocument()
    expect(screen.getByText("Rec Two")).toBeInTheDocument()
  })

  it("shows a light hint (not an empty void) when there are no recommendations", () => {
    render(<Discover initialRecommendations={[]} />)
    expect(screen.getByText("discover.recommendationsEmptyTitle")).toBeInTheDocument()
  })
})
