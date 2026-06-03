import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { apiClient } from "@/lib/api-client"
import type { Notification } from "@/types/api"
import { useGlobalStore } from "./global-store"

const notifyMock = vi.hoisted(() => ({ notifyError: vi.fn() }))
vi.mock("@/lib/notify", () => ({
  notifyError: notifyMock.notifyError,
  notifySuccess: vi.fn(),
  notifyInfo: vi.fn(),
  notifyWarning: vi.fn(),
}))

function notif(over: Partial<Notification> = {}): Notification {
  return {
    id: "n1",
    type: "task_completed",
    category: "task",
    priority: "normal",
    params: {},
    action_url: null,
    title: null,
    message: null,
    created_at: "2026-06-03T00:00:00Z",
    read_at: null,
    ...over,
  }
}

function resetNotifications() {
  useGlobalStore.setState({
    notifications: [],
    unreadCount: 0,
    notificationsLoaded: false,
    notificationsLoading: false,
    notificationsError: null,
    notificationsPage: 0,
    notificationsHasMore: true,
  })
}

describe("global-store addNotificationFromWebSocket", () => {
  beforeEach(() => {
    resetNotifications()
  })

  it("prepends an unread notification and bumps unreadCount", () => {
    useGlobalStore.getState().addNotificationFromWebSocket(notif({ id: "a" }))

    const s = useGlobalStore.getState()
    expect(s.notifications.map((n) => n.id)).toEqual(["a"])
    expect(s.unreadCount).toBe(1)
  })

  it("dedupes by id and does not double-count", () => {
    const store = useGlobalStore.getState()
    store.addNotificationFromWebSocket(notif({ id: "a" }))
    store.addNotificationFromWebSocket(notif({ id: "a" }))

    const s = useGlobalStore.getState()
    expect(s.notifications).toHaveLength(1)
    expect(s.unreadCount).toBe(1)
  })

  it("does not bump unreadCount for an already-read notification", () => {
    useGlobalStore
      .getState()
      .addNotificationFromWebSocket(
        notif({ id: "a", read_at: "2026-06-03T01:00:00Z" })
      )

    expect(useGlobalStore.getState().unreadCount).toBe(0)
  })

  it("caps the feed at 100, keeping the newest", () => {
    const store = useGlobalStore.getState()
    for (let i = 0; i < 105; i++) {
      store.addNotificationFromWebSocket(notif({ id: `id-${i}` }))
    }

    const s = useGlobalStore.getState()
    expect(s.notifications).toHaveLength(100)
    expect(s.notifications[0].id).toBe("id-104")
    expect(s.notifications[99].id).toBe("id-5")
  })
})

describe("global-store loadNotifications", () => {
  beforeEach(() => {
    resetNotifications()
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("fresh load (page 1) replaces the feed and sets hasMore from total", async () => {
    vi.spyOn(apiClient, "getNotifications").mockResolvedValue({
      items: [notif({ id: "a" }), notif({ id: "b" })],
      total: 5,
      page: 1,
      page_size: 20,
    })

    await useGlobalStore.getState().loadNotifications()

    const s = useGlobalStore.getState()
    expect(s.notifications.map((n) => n.id)).toEqual(["a", "b"])
    expect(s.notificationsPage).toBe(1)
    expect(s.notificationsHasMore).toBe(true)
    expect(s.notificationsLoaded).toBe(true)
    expect(s.notificationsLoading).toBe(false)
    expect(s.notificationsError).toBeNull()
  })

  it("append loads the next page and concatenates older items", async () => {
    useGlobalStore.setState({
      notifications: [notif({ id: "a" })],
      notificationsPage: 1,
      notificationsHasMore: true,
      notificationsLoaded: true,
    })
    const spy = vi
      .spyOn(apiClient, "getNotifications")
      .mockResolvedValue({
        items: [notif({ id: "b" })],
        total: 2,
        page: 2,
        page_size: 20,
      })

    await useGlobalStore.getState().loadNotifications({ append: true })

    expect(spy).toHaveBeenCalledWith({ page: 2, page_size: 20 })
    const s = useGlobalStore.getState()
    expect(s.notifications.map((n) => n.id)).toEqual(["a", "b"])
    expect(s.notificationsPage).toBe(2)
    expect(s.notificationsHasMore).toBe(false)
  })

  it("sets error state and stops loading when the API rejects", async () => {
    vi.spyOn(apiClient, "getNotifications").mockRejectedValue(
      new Error("boom")
    )

    await useGlobalStore.getState().loadNotifications()

    const s = useGlobalStore.getState()
    expect(s.notificationsLoading).toBe(false)
    expect(s.notificationsError).toBe("boom")
  })
})

describe("global-store refreshUnread", () => {
  beforeEach(() => {
    resetNotifications()
    vi.restoreAllMocks()
  })

  it("sets unreadCount from the server stats", async () => {
    vi.spyOn(apiClient, "getNotificationStats").mockResolvedValue({
      total: 9,
      unread: 4,
    })

    await useGlobalStore.getState().refreshUnread()

    expect(useGlobalStore.getState().unreadCount).toBe(4)
  })
})

describe("global-store markAsRead", () => {
  beforeEach(() => {
    resetNotifications()
    vi.restoreAllMocks()
    notifyMock.notifyError.mockClear()
  })

  it("optimistically sets read_at and applies server unread count", async () => {
    useGlobalStore.setState({
      notifications: [notif({ id: "a" }), notif({ id: "b" })],
      unreadCount: 2,
    })
    vi.spyOn(apiClient, "markNotificationRead").mockResolvedValue({
      unread: 1,
    })

    await useGlobalStore.getState().markAsRead("a")

    const s = useGlobalStore.getState()
    expect(s.notifications.find((n) => n.id === "a")?.read_at).not.toBeNull()
    expect(s.notifications.find((n) => n.id === "b")?.read_at).toBeNull()
    expect(s.unreadCount).toBe(1)
    expect(notifyMock.notifyError).not.toHaveBeenCalled()
  })

  it("rolls back read_at and unreadCount and notifies on failure", async () => {
    useGlobalStore.setState({
      notifications: [notif({ id: "a" })],
      unreadCount: 1,
    })
    vi.spyOn(apiClient, "markNotificationRead").mockRejectedValue(
      new Error("nope")
    )

    await useGlobalStore.getState().markAsRead("a")

    const s = useGlobalStore.getState()
    expect(s.notifications.find((n) => n.id === "a")?.read_at).toBeNull()
    expect(s.unreadCount).toBe(1)
    expect(notifyMock.notifyError).toHaveBeenCalled()
  })
})

describe("global-store markAllAsRead", () => {
  beforeEach(() => {
    resetNotifications()
    vi.restoreAllMocks()
    notifyMock.notifyError.mockClear()
  })

  it("optimistically marks all read and applies server unread", async () => {
    useGlobalStore.setState({
      notifications: [notif({ id: "a" }), notif({ id: "b" })],
      unreadCount: 2,
    })
    vi.spyOn(apiClient, "markAllNotificationsRead").mockResolvedValue({
      affected: 2,
      unread: 0,
    })

    await useGlobalStore.getState().markAllAsRead()

    const s = useGlobalStore.getState()
    expect(s.notifications.every((n) => n.read_at !== null)).toBe(true)
    expect(s.unreadCount).toBe(0)
    expect(notifyMock.notifyError).not.toHaveBeenCalled()
  })

  it("rolls back the whole list and notifies on failure", async () => {
    const before = [notif({ id: "a" }), notif({ id: "b" })]
    useGlobalStore.setState({ notifications: before, unreadCount: 2 })
    vi.spyOn(apiClient, "markAllNotificationsRead").mockRejectedValue(
      new Error("nope")
    )

    await useGlobalStore.getState().markAllAsRead()

    const s = useGlobalStore.getState()
    expect(s.notifications.every((n) => n.read_at === null)).toBe(true)
    expect(s.unreadCount).toBe(2)
    expect(notifyMock.notifyError).toHaveBeenCalled()
  })
})
