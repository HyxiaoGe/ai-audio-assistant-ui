import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({ locale: "zh", t: (k: string) => k }),
}))
vi.mock("@/hooks/use-version-check", () => ({ useVersionCheck: () => {} }))
const notifyInfo = vi.fn()
vi.mock("@/lib/notify", () => ({ notifyInfo: (...a: unknown[]) => notifyInfo(...a) }))

import { UpdateBanner } from "./UpdateBanner"
import { useVersionStore } from "@/store/version-store"

const INITIAL = {
  backendBaseline: null,
  backendLatest: null,
  backendOutdated: false,
  frontendLatest: null,
  frontendOutdated: false,
  dismissedBackend: null,
  dismissedFrontend: null,
}

describe("UpdateBanner", () => {
  beforeEach(() => {
    useVersionStore.setState({ ...INITIAL })
    notifyInfo.mockClear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders nothing when nothing is outdated", () => {
    const { container } = render(<UpdateBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it("shows the refresh banner when frontend is outdated", () => {
    useVersionStore.setState({ frontendOutdated: true })
    render(<UpdateBanner />)
    expect(screen.getByText("version.frontendUpdated")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "version.refresh" })).toBeInTheDocument()
  })

  it("reloads the page when refresh is clicked", () => {
    const reload = vi.fn()
    Object.defineProperty(window, "location", { value: { reload }, writable: true })
    useVersionStore.setState({ frontendOutdated: true })
    render(<UpdateBanner />)
    fireEvent.click(screen.getByRole("button", { name: "version.refresh" }))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it("dismissing the frontend banner hides it", () => {
    useVersionStore.setState({ frontendOutdated: true, frontendLatest: "front-B" })
    render(<UpdateBanner />)
    fireEvent.click(screen.getByRole("button", { name: "common.dismiss" }))
    expect(useVersionStore.getState().frontendOutdated).toBe(false)
  })

  it("fires a toast and clears the flag when backend is outdated", () => {
    useVersionStore.setState({ backendOutdated: true, backendLatest: "back-2" })
    render(<UpdateBanner />)
    expect(notifyInfo).toHaveBeenCalledWith("version.backendUpdated")
    expect(useVersionStore.getState().backendOutdated).toBe(false)
  })
})
