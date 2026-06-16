import React from "react"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const auth = vi.hoisted(() => ({ user: null as { name?: string } | null, status: "unauthenticated" as string }))
const replaceMock = vi.hoisted(() => vi.fn())

vi.mock("@/store/auth-store", () => ({
  useAuthStore: (selector: (s: typeof auth) => unknown) => selector(auth),
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}))
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }) }))
vi.mock("@/lib/settings-context", () => ({ useSettingsActions: () => ({ setTheme: vi.fn() }) }))
vi.mock("@/components/common/FullPageLoader", () => ({ default: () => <div>loader</div> }))
vi.mock("@/components/auth/LoginModal", () => ({ default: () => null }))
vi.mock("@/components/task/NewTaskModal", () => ({ default: () => null }))
vi.mock("@/components/pages/Dashboard", () => ({ default: () => <div>dashboard</div> }))

import DashboardPage from "./page"

beforeEach(() => {
  auth.user = null
  auth.status = "unauthenticated"
  replaceMock.mockClear()
})

describe("首页落地", () => {
  it("未登录(已解析)重定向到 /explore,不渲染 Dashboard、不停留首页", () => {
    render(<DashboardPage />)
    expect(replaceMock).toHaveBeenCalledWith("/explore")
    expect(screen.queryByText("dashboard")).not.toBeInTheDocument()
    // 重定向期间渲染轻量 loader（不渲染整页 Explore，避免闪一下又跳）
    expect(screen.getByText("loader")).toBeInTheDocument()
  })

  it("已登录渲染 Dashboard 且不重定向", () => {
    auth.user = { name: "Sean" }
    auth.status = "authenticated"
    render(<DashboardPage />)
    expect(screen.getByText("dashboard")).toBeInTheDocument()
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it("加载态(登录态未解析)渲染 loader 且不重定向（不误伤将解析为已登录的用户）", () => {
    auth.status = "loading"
    render(<DashboardPage />)
    expect(screen.getByText("loader")).toBeInTheDocument()
    expect(replaceMock).not.toHaveBeenCalled()
  })
})
