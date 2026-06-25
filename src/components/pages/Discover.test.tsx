import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const i18n = vi.hoisted(() => ({ t: (k: string) => k }))
const stores = vi.hoisted(() => ({ authed: true, openLogin: vi.fn(), openNewTask: vi.fn() }))
const client = vi.hoisted(() => ({ searchYouTube: vi.fn() }))

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

function hit(vid: string, title: string) {
  return { video_id: vid, title, channel: null, channel_id: null, thumbnail: null, url: `https://www.youtube.com/watch?v=${vid}` }
}

beforeEach(() => {
  vi.clearAllMocks()
  stores.authed = true
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
