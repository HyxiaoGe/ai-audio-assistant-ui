import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const replaceMock = vi.hoisted(() => vi.fn())
const mockClient = vi.hoisted(() => ({ getPublicTask: vi.fn() }))

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: replaceMock, push: vi.fn() }) }))
vi.mock("@/lib/use-api-client", () => ({ useAPIClient: () => mockClient }))

import { usePublicOwnerRedirect } from "./use-public-owner-redirect"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("usePublicOwnerRedirect(直达公开详情时本人内容跳私有详情)", () => {
  it("登录且 is_owner → router.replace 到 /tasks/[id]", async () => {
    mockClient.getPublicTask.mockResolvedValue({ id: "t1", is_owner: true })
    renderHook(() => usePublicOwnerRedirect("t1", true))
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/tasks/t1"))
    // 带 token 刷新才能拿到 is_owner
    expect(mockClient.getPublicTask).toHaveBeenCalledWith("t1", { authenticated: true })
  })

  it("登录但非 is_owner → 不跳转(留在公开详情)", async () => {
    mockClient.getPublicTask.mockResolvedValue({ id: "t1", is_owner: false })
    renderHook(() => usePublicOwnerRedirect("t1", true))
    await waitFor(() => expect(mockClient.getPublicTask).toHaveBeenCalled())
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it("匿名(未登录)→ 不发起带 token 刷新,不跳转", async () => {
    renderHook(() => usePublicOwnerRedirect("t1", false))
    await Promise.resolve()
    expect(mockClient.getPublicTask).not.toHaveBeenCalled()
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it("刷新失败 → 静默降级,不跳转", async () => {
    mockClient.getPublicTask.mockRejectedValue(new Error("boom"))
    renderHook(() => usePublicOwnerRedirect("t1", true))
    await waitFor(() => expect(mockClient.getPublicTask).toHaveBeenCalled())
    expect(replaceMock).not.toHaveBeenCalled()
  })
})
