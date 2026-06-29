import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  useVersionStore,
  recordBackendVersion,
  recordFrontendVersion,
  dismissBackend,
  dismissFrontend,
} from "./version-store"

const INITIAL = {
  backendBaseline: null,
  backendLatest: null,
  backendOutdated: false,
  frontendLatest: null,
  frontendOutdated: false,
  dismissedBackend: null,
  dismissedFrontend: null,
}

describe("version-store", () => {
  beforeEach(() => {
    useVersionStore.setState({ ...INITIAL })
    vi.stubEnv("NEXT_PUBLIC_BUILD_SHA", "front-A")
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // ---- 后端 ----
  it("first backend version sets baseline without alerting", () => {
    recordBackendVersion("back-1")
    const s = useVersionStore.getState()
    expect(s.backendBaseline).toBe("back-1")
    expect(s.backendOutdated).toBe(false)
  })

  it("backend version change after baseline flips outdated", () => {
    recordBackendVersion("back-1")
    recordBackendVersion("back-2")
    expect(useVersionStore.getState().backendOutdated).toBe(true)
  })

  it("ignores dev/empty backend sentinel", () => {
    recordBackendVersion("dev")
    recordBackendVersion(null)
    recordBackendVersion("")
    const s = useVersionStore.getState()
    expect(s.backendBaseline).toBeNull()
    expect(s.backendOutdated).toBe(false)
  })

  it("dismissBackend silences the same version but a newer one re-alerts", () => {
    recordBackendVersion("back-1")
    recordBackendVersion("back-2")
    dismissBackend()
    expect(useVersionStore.getState().backendOutdated).toBe(false)
    recordBackendVersion("back-2") // 同版本:仍静默
    expect(useVersionStore.getState().backendOutdated).toBe(false)
    recordBackendVersion("back-3") // 更新版本:再报警
    expect(useVersionStore.getState().backendOutdated).toBe(true)
  })

  // ---- 前端 ----
  it("frontend version equal to inlined baseline does not alert", () => {
    recordFrontendVersion("front-A")
    expect(useVersionStore.getState().frontendOutdated).toBe(false)
  })

  it("frontend version different from baseline flips outdated", () => {
    recordFrontendVersion("front-B")
    expect(useVersionStore.getState().frontendOutdated).toBe(true)
  })

  it("short-circuits when the inlined frontend baseline is dev", () => {
    vi.stubEnv("NEXT_PUBLIC_BUILD_SHA", "dev")
    recordFrontendVersion("front-B")
    expect(useVersionStore.getState().frontendOutdated).toBe(false)
  })

  it("dismissFrontend silences the same version but a newer one re-alerts", () => {
    recordFrontendVersion("front-B")
    dismissFrontend()
    expect(useVersionStore.getState().frontendOutdated).toBe(false)
    recordFrontendVersion("front-B")
    expect(useVersionStore.getState().frontendOutdated).toBe(false)
    recordFrontendVersion("front-C")
    expect(useVersionStore.getState().frontendOutdated).toBe(true)
  })
})
