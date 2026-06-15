import React from "react"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const auth = vi.hoisted(() => ({ user: null as { name?: string } | null, status: "unauthenticated" as string }))

vi.mock("@/store/auth-store", () => ({
  useAuthStore: (selector: (s: typeof auth) => unknown) => selector(auth),
}))
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }) }))
vi.mock("@/lib/settings-context", () => ({ useSettingsActions: () => ({ setTheme: vi.fn() }) }))
vi.mock("@/components/common/FullPageLoader", () => ({ default: () => <div>loader</div> }))
vi.mock("@/components/auth/LoginModal", () => ({ default: () => null }))
vi.mock("@/components/task/NewTaskModal", () => ({ default: () => null }))
vi.mock("@/components/pages/Dashboard", () => ({ default: () => <div>dashboard</div> }))
vi.mock("@/components/pages/Explore", () => ({ default: () => <div>explore-plaza</div> }))

import DashboardPage from "./page"

beforeEach(() => {
  auth.user = null
  auth.status = "unauthenticated"
})

describe("首页落地", () => {
  it("未登录渲染探索广场,不渲染 Dashboard(不触发登录墙)", () => {
    render(<DashboardPage />)
    expect(screen.getByText("explore-plaza")).toBeInTheDocument()
    expect(screen.queryByText("dashboard")).not.toBeInTheDocument()
  })

  it("已登录渲染 Dashboard", () => {
    auth.user = { name: "Sean" }
    auth.status = "authenticated"
    render(<DashboardPage />)
    expect(screen.getByText("dashboard")).toBeInTheDocument()
    expect(screen.queryByText("explore-plaza")).not.toBeInTheDocument()
  })

  it("加载态渲染 loader", () => {
    auth.status = "loading"
    render(<DashboardPage />)
    expect(screen.getByText("loader")).toBeInTheDocument()
  })
})
