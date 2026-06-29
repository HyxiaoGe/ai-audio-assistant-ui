import { afterEach, describe, expect, it, vi } from "vitest"
import { GET } from "./route"

describe("/version route handler", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns the inlined build sha with no-store", async () => {
    vi.stubEnv("NEXT_PUBLIC_BUILD_SHA", "abc123")
    const res = GET()
    expect(res.headers.get("Cache-Control")).toBe("no-store")
    expect(await res.json()).toEqual({ version: "abc123" })
  })

  it("falls back to dev when unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_BUILD_SHA", "")
    const res = GET()
    expect(await res.json()).toEqual({ version: "dev" })
  })
})
