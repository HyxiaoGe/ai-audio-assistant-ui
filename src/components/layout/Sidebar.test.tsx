import React from "react"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// 侧栏按登录态过滤：未登录只留「探索」，已登录补齐全量（admin 仍受 isAdmin 控）。
// i18n mock 返回 key，故菜单文案即 nav.* / admin.console。
const auth = vi.hoisted(() => ({ user: null as { name?: string } | null }))
const userStore = vi.hoisted(() => ({ isAdmin: false }))

vi.mock("@/store/auth-store", () => ({
  useAuthStore: (sel: (s: typeof auth) => unknown) => sel(auth),
}))
vi.mock("@/store/user-store", () => ({
  useUserStore: (sel: (s: typeof userStore) => unknown) => sel(userStore),
}))
vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/explore",
}))

import Sidebar from "./Sidebar"

beforeEach(() => {
  auth.user = null
  userStore.isAdmin = false
})

const LOGGED_IN_ONLY = ["nav.overview", "nav.tasks", "nav.subscriptions", "nav.stats", "nav.settings"]

describe("Sidebar 按登录态过滤", () => {
  it("未登录：只渲染「探索」，隐藏概览/任务/订阅/统计/设置", () => {
    render(<Sidebar />)
    expect(screen.getByText("nav.explore")).toBeInTheDocument()
    for (const key of LOGGED_IN_ONLY) {
      expect(screen.queryByText(key)).not.toBeInTheDocument()
    }
    expect(screen.queryByText("admin.console")).not.toBeInTheDocument()
  })

  it("已登录（非 admin）：渲染全部非 admin 项，不渲染 admin", () => {
    auth.user = { name: "Sean" }
    render(<Sidebar />)
    for (const key of [...LOGGED_IN_ONLY, "nav.explore"]) {
      expect(screen.getByText(key)).toBeInTheDocument()
    }
    expect(screen.queryByText("admin.console")).not.toBeInTheDocument()
  })

  it("已登录 admin：含 admin 项", () => {
    auth.user = { name: "Sean" }
    userStore.isAdmin = true
    render(<Sidebar />)
    expect(screen.getByText("nav.explore")).toBeInTheDocument()
    expect(screen.getByText("admin.console")).toBeInTheDocument()
  })

  it("未登录即便 isAdmin 误为 true 也不渲染 admin（防御性双重 gate）", () => {
    auth.user = null
    userStore.isAdmin = true
    render(<Sidebar />)
    expect(screen.queryByText("admin.console")).not.toBeInTheDocument()
  })
})
