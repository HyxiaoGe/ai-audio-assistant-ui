import { create } from "zustand"

// 本标签页加载时所属的前端构建 SHA。NEXT_PUBLIC_BUILD_SHA 在 build 时被内联进 bundle,
// 旧标签页持有的就是它那次构建的值,永不变;dev/未构建为 "dev"(比较短路)。
// 读成函数而非模块常量,便于测试用 vi.stubEnv 控制(运行时 Next 已内联为字面量,行为一致)。
function frontendBaseline(): string {
  return process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev"
}

interface VersionState {
  backendBaseline: string | null
  backendLatest: string | null
  backendOutdated: boolean
  frontendLatest: string | null
  frontendOutdated: boolean
  dismissedBackend: string | null
  dismissedFrontend: string | null
}

export const useVersionStore = create<VersionState>(() => ({
  backendBaseline: null,
  backendLatest: null,
  backendOutdated: false,
  frontendLatest: null,
  frontendOutdated: false,
  dismissedBackend: null,
  dismissedFrontend: null,
}))

function isSentinel(v: string | null | undefined): boolean {
  return !v || v === "dev"
}

export function recordBackendVersion(v: string | null): void {
  if (isSentinel(v)) return
  const s = useVersionStore.getState()
  if (s.backendBaseline === null) {
    useVersionStore.setState({ backendBaseline: v, backendLatest: v })
    return
  }
  const outdated = v !== s.backendBaseline && v !== s.dismissedBackend
  useVersionStore.setState({ backendLatest: v, backendOutdated: s.backendOutdated || outdated })
}

export function recordFrontendVersion(v: string | null): void {
  if (isSentinel(v) || frontendBaseline() === "dev") return
  const s = useVersionStore.getState()
  const outdated = v !== frontendBaseline() && v !== s.dismissedFrontend
  useVersionStore.setState({ frontendLatest: v, frontendOutdated: s.frontendOutdated || outdated })
}

export function dismissBackend(): void {
  useVersionStore.setState((s) => ({ dismissedBackend: s.backendLatest, backendOutdated: false }))
}

export function dismissFrontend(): void {
  useVersionStore.setState((s) => ({ dismissedFrontend: s.frontendLatest, frontendOutdated: false }))
}
