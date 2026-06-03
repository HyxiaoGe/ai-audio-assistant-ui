import { describe, expect, it, vi } from "vitest"

// 导入整个 hook 模块会顺带拉起 next/navigation；与仓内其他 hook/组件测试一致地打桩。
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import { makeVisibilityRefetch } from "@/hooks/use-global-websocket"

describe("makeVisibilityRefetch", () => {
  it("refetches list + unread when the document becomes visible", () => {
    const loadNotifications = vi.fn()
    const refreshUnread = vi.fn()
    const handler = makeVisibilityRefetch(loadNotifications, refreshUnread)

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    })
    handler()

    expect(loadNotifications).toHaveBeenCalledTimes(1)
    expect(refreshUnread).toHaveBeenCalledTimes(1)
  })

  it("does nothing while the document is hidden", () => {
    const loadNotifications = vi.fn()
    const refreshUnread = vi.fn()
    const handler = makeVisibilityRefetch(loadNotifications, refreshUnread)

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    })
    handler()

    expect(loadNotifications).not.toHaveBeenCalled()
    expect(refreshUnread).not.toHaveBeenCalled()
  })
})
