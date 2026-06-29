import { render, screen, fireEvent } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const push = vi.fn()
vi.mock("@/lib/i18n-context", () => ({ useI18n: () => ({ t: (k: string) => k }) }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))

import AdminTaskLookup from "./AdminTaskLookup"

afterEach(() => vi.clearAllMocks())

describe("AdminTaskLookup", () => {
  it("空输入时按钮禁用", () => {
    render(<AdminTaskLookup />)
    expect(screen.getByRole("button", { name: "admin.taskLookup.go" })).toBeDisabled()
  })

  it("输入 task_id 后跳转 admin 详情", () => {
    render(<AdminTaskLookup />)
    fireEvent.change(screen.getByPlaceholderText("admin.taskLookup.placeholder"), { target: { value: " abc-123 " } })
    fireEvent.click(screen.getByRole("button", { name: "admin.taskLookup.go" }))
    expect(push).toHaveBeenCalledWith("/admin/tasks/abc-123")
  })
})
