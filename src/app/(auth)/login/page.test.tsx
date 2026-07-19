import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import LoginPage from "./page"

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useRouter: () => router }))
vi.mock("@/components/auth/LoginModal", () => ({
  default: ({
    onClose,
    onAuthenticated,
  }: {
    onClose: () => void
    onAuthenticated: () => void
  }) => (
    <>
      <button onClick={onClose}>关闭</button>
      <button onClick={onAuthenticated}>登录成功</button>
    </>
  ),
}))

describe("登录页", () => {
  beforeEach(() => vi.clearAllMocks())

  it("手动关闭返回首页", () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole("button", { name: "关闭" }))
    expect(router.push).toHaveBeenCalledWith("/")
  })

  it("认证成功进入任务页", () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole("button", { name: "登录成功" }))
    expect(router.replace).toHaveBeenCalledWith("/tasks")
  })
})
