import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createAPIClient } from "./api-client"
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

describe("api-client records backend X-App-Version", () => {
  beforeEach(() => {
    localStorage.clear()
    useVersionStore.setState({ ...INITIAL })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("captures the X-App-Version response header into the version store", async () => {
    const body = JSON.stringify({ code: 0, message: "ok", data: {}, traceId: "t" })
    const fetchMock = vi.fn(
      async () =>
        new Response(body, {
          status: 200,
          headers: { "Content-Type": "application/json", "X-App-Version": "sha-1" },
        }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const client = createAPIClient("test-token")
    await client.getTaskStatusCounts()

    expect(useVersionStore.getState().backendBaseline).toBe("sha-1")
  })

  it("ignores responses without the header (no false baseline)", async () => {
    const body = JSON.stringify({ code: 0, message: "ok", data: {}, traceId: "t" })
    const fetchMock = vi.fn(
      async () => new Response(body, { status: 200, headers: { "Content-Type": "application/json" } }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const client = createAPIClient("test-token")
    await client.getTaskStatusCounts()

    expect(useVersionStore.getState().backendBaseline).toBeNull()
  })
})
