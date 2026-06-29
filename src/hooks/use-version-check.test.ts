import { afterEach, describe, expect, it, vi } from "vitest"
import { pollVersionOnce, pollWhenVisible } from "@/hooks/use-version-check"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function setVisibility(state: "visible" | "hidden"): void {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state })
}

describe("pollVersionOnce", () => {
  it("feeds the fetched version into the recorder", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ version: "front-B" }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const record = vi.fn()

    await pollVersionOnce(record)

    expect(fetchMock).toHaveBeenCalledWith("/version", { cache: "no-store" })
    expect(record).toHaveBeenCalledWith("front-B")
  })

  it("stays silent on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down") }))
    const record = vi.fn()

    await expect(pollVersionOnce(record)).resolves.toBeUndefined()
    expect(record).not.toHaveBeenCalled()
  })

  it("ignores non-ok responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 503 })))
    const record = vi.fn()

    await pollVersionOnce(record)
    expect(record).not.toHaveBeenCalled()
  })
})

describe("pollWhenVisible", () => {
  it("polls when the tab is visible", () => {
    setVisibility("visible")
    const poll = vi.fn()
    expect(pollWhenVisible(poll)).toBe(true)
    expect(poll).toHaveBeenCalledTimes(1)
  })

  it("does not poll when the tab is hidden", () => {
    setVisibility("hidden")
    const poll = vi.fn()
    expect(pollWhenVisible(poll)).toBe(false)
    expect(poll).not.toHaveBeenCalled()
  })
})
