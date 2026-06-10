import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockClient = vi.hoisted(() => ({ updateTaskVisibility: vi.fn() }))
const storeState = vi.hoisted(() => ({ isAdmin: true, profileLoaded: true }))

vi.mock("@/lib/use-api-client", () => ({ useAPIClient: () => mockClient }))
vi.mock("@/lib/i18n-context", () => ({ useI18n: () => ({ locale: "zh", t: (key: string) => key }) }))
vi.mock("@/lib/notify", () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
vi.mock("@/store/user-store", () => ({
  useUserStore: (selector: (s: typeof storeState) => unknown) => selector(storeState),
}))

import { notifyError } from "@/lib/notify"
import { TaskVisibilityToggle } from "./TaskVisibilityToggle"

beforeEach(() => {
  vi.clearAllMocks()
  storeState.isAdmin = true
  storeState.profileLoaded = true
})

describe("TaskVisibilityToggle", () => {
  it("管理员 + completed:渲染「设为公开」,点击调用接口并回调", async () => {
    mockClient.updateTaskVisibility.mockResolvedValue({
      id: "t1",
      is_public: true,
      published_at: "2026-06-10T00:00:00Z",
    })
    const onChanged = vi.fn()
    render(<TaskVisibilityToggle taskId="t1" status="completed" isPublic={false} onChanged={onChanged} />)
    fireEvent.click(screen.getByText("task.visibilityMakePublic"))
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(true, "2026-06-10T00:00:00Z"))
    expect(mockClient.updateTaskVisibility).toHaveBeenCalledWith("t1", true)
  })

  it("已公开时渲染「已公开」,点击取消公开", async () => {
    mockClient.updateTaskVisibility.mockResolvedValue({ id: "t1", is_public: false, published_at: null })
    const onChanged = vi.fn()
    render(<TaskVisibilityToggle taskId="t1" status="completed" isPublic={true} onChanged={onChanged} />)
    fireEvent.click(screen.getByText("task.visibilityPublic"))
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(false, null))
    expect(mockClient.updateTaskVisibility).toHaveBeenCalledWith("t1", false)
  })

  it("非管理员不渲染", () => {
    storeState.isAdmin = false
    const { container } = render(
      <TaskVisibilityToggle taskId="t1" status="completed" isPublic={false} onChanged={() => {}} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("未完成任务不渲染", () => {
    const { container } = render(
      <TaskVisibilityToggle taskId="t1" status="summarizing" isPublic={false} onChanged={() => {}} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("接口失败:notifyError 被调用、onChanged 未调用、按钮恢复非 disabled", async () => {
    mockClient.updateTaskVisibility.mockRejectedValue(new Error('fail'))
    const onChanged = vi.fn()
    render(<TaskVisibilityToggle taskId="t1" status="completed" isPublic={false} onChanged={onChanged} />)
    fireEvent.click(screen.getByRole("button"))
    await waitFor(() => expect(screen.getByRole("button")).not.toBeDisabled())
    expect(notifyError).toHaveBeenCalledTimes(1)
    expect(onChanged).not.toHaveBeenCalled()
  })
})
