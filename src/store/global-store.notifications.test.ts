import { beforeEach, describe, expect, it } from "vitest"
import type { Notification } from "@/types/api"
import { useGlobalStore } from "./global-store"

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
