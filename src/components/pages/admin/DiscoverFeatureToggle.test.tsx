import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const client = vi.hoisted(() => ({ getDiscoverConfig: vi.fn(), setDiscoverEnabled: vi.fn() }))
vi.mock("@/lib/use-api-client", () => ({ useAPIClient: () => client }))
vi.mock("@/lib/i18n-context", () => ({ useI18n: () => ({ t: (k: string) => k, locale: "en" }) }))
vi.mock("@/lib/notify", () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))

import DiscoverFeatureToggle from "./DiscoverFeatureToggle"

describe("DiscoverFeatureToggle", () => {
  it("关闭需二次确认后才调用 setDiscoverEnabled(false)", async () => {
    client.getDiscoverConfig.mockResolvedValue({ enabled: true })
    client.setDiscoverEnabled.mockResolvedValue({ enabled: false })
    render(<DiscoverFeatureToggle />)
    await waitFor(() => screen.getByRole("button", { name: "admin.discover.disableAction" }))
    fireEvent.click(screen.getByRole("button", { name: "admin.discover.disableAction" }))
    expect(client.setDiscoverEnabled).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "admin.discover.confirmDisable" }))
    await waitFor(() => expect(client.setDiscoverEnabled).toHaveBeenCalledWith(false))
  })

  it("读取失败默认显示为已启用(可点下线)", async () => {
    client.getDiscoverConfig.mockRejectedValue(new Error("404"))
    render(<DiscoverFeatureToggle />)
    await waitFor(() => screen.getByRole("button", { name: "admin.discover.disableAction" }))
  })
})
