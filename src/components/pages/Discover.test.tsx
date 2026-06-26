import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const i18n = vi.hoisted(() => ({ t: (k: string) => k }))
const stores = vi.hoisted(() => ({ authed: true, openLogin: vi.fn(), openNewTask: vi.fn() }))
const client = vi.hoisted(() => ({ searchYouTube: vi.fn(), getYouTubeTrending: vi.fn() }))

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
  useDiscoverStore.getState().reset() // 模块单例 store 跨用例残留,逐例清零
})

describe("Discover trending", () => {
  it("renders trending chips from initialTrending and searches on chip click", async () => {
    client.searchYouTube.mockResolvedValue({ query: "news", cached: true, items: [] })
    render(<Discover initialTrending={[{ query: "news", count: 9 }, { query: "music", count: 4 }]} />)
    expect(screen.getByText("discover.trendingLabel")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "news" }))
    await waitFor(() => expect(client.searchYouTube).toHaveBeenCalledWith("news", { authenticated: true }))
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
    expect(client.searchYouTube).toHaveBeenCalledWith("cats", { authenticated: true })
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
})
