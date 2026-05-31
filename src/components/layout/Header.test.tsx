import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import Header from "./Header"

// audit a11y（Header 集群）：迷你播放器的播放/暂停按钮、整行「打开任务」交互、
// 停止按钮、主题切换、账户菜单触发器都缺可访问名/键盘可达/菜单语义。
// i18n mock 返回 key，故可访问名即 key。

const audioState = {
  src: "/api/v1/media/x",
  title: "Some Audio Title",
  taskId: "task-9",
  isPlaying: false,
  currentTime: 10,
  duration: 100,
  toggle: vi.fn(),
  seek: vi.fn(),
  stop: vi.fn(),
}
const authState = {
  user: { name: "Sean", email: "sean@example.com", avatar_url: "" },
  status: "authenticated",
  logout: vi.fn(),
}
const userState = {
  loadProfile: vi.fn(),
  profile: null,
  profileLoaded: true,
  isAdmin: false,
}
const pushMock = vi.fn()

vi.mock("@/store/audio-store", () => ({
  useAudioStore: (sel: (s: typeof audioState) => unknown) => sel(audioState),
}))
vi.mock("@/store/auth-store", () => ({
  useAuthStore: (sel: (s: typeof authState) => unknown) => sel(authState),
}))
vi.mock("@/store/user-store", () => ({
  useUserStore: (sel: (s: typeof userState) => unknown) => sel(userState),
}))
vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}))
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }))
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: pushMock }),
}))
vi.mock("@/components/notifications/NotificationBell", () => ({
  default: () => null,
}))

function renderHeader() {
  return render(<Header isAuthenticated onOpenLogin={vi.fn()} />)
}

beforeEach(() => {
  audioState.isPlaying = false
  audioState.duration = 100
  audioState.currentTime = 10
  pushMock.mockClear()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("Header mini-player a11y", () => {
  it("labels the play/pause button with state and an explicit type", () => {
    renderHeader()
    const playBtn = screen.getByRole("button", { name: "player.play" })
    expect(playBtn).toHaveAttribute("type", "button")
  })

  it("makes the whole mini-player a keyboard-operable open-task control", () => {
    renderHeader()
    const opener = screen.getByRole("button", { name: "audio.openTask" })
    expect(opener).toHaveAttribute("tabindex", "0")

    fireEvent.keyDown(opener, { key: "Enter" })
    expect(pushMock).toHaveBeenCalledWith("/tasks/task-9")

    fireEvent.click(opener)
    expect(pushMock).toHaveBeenCalledTimes(2)
  })

  it("gives the stop/dismiss button a real accessible name (not title-only)", () => {
    renderHeader()
    expect(screen.getByRole("button", { name: "common.dismiss" })).toHaveAttribute("type", "button")
  })

  it("clamps the mini-player slider bounds when duration is invalid", () => {
    audioState.duration = NaN
    audioState.currentTime = 30
    renderHeader()
    const slider = screen.getByRole("slider")
    expect(slider).toHaveAttribute("aria-valuemax", "0")
    expect(slider).toHaveAttribute("aria-valuenow", "0")
  })
})

describe("Header chrome controls a11y", () => {
  it("labels the theme-toggle button (not title-only)", () => {
    renderHeader()
    expect(screen.getByRole("button", { name: "header.switchToDark" })).toHaveAttribute("type", "button")
  })

  it("exposes the account menu trigger with name + popup semantics", () => {
    renderHeader()
    const trigger = screen.getByRole("button", { name: "header.userMenu" })
    expect(trigger).toHaveAttribute("aria-haspopup", "menu")
    expect(trigger).toHaveAttribute("aria-expanded", "false")

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("menuitem", { name: "auth.logout" })).toBeInTheDocument()
  })

  it("closes the account menu on Escape and restores focus to the trigger", () => {
    renderHeader()
    const trigger = screen.getByRole("button", { name: "header.userMenu" })
    fireEvent.click(trigger)
    expect(screen.getByRole("menuitem", { name: "auth.logout" })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("menuitem", { name: "auth.logout" })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
