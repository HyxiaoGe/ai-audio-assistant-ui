export type AuthSessionTransitionState = "stable" | "synchronizing" | "blocked"

let transitionState: AuthSessionTransitionState = "stable"
let transitionEpoch = 0
const activeControllers = new Set<AbortController>()
const activeClosers = new Set<() => void>()

export class AuthSessionTransitionError extends Error {
  readonly code = "AUTH_SESSION_TRANSITION"

  constructor(message: string = "账户正在同步，请稍后重试") {
    super(message)
    this.name = "AuthSessionTransitionError"
  }
}

function stopOldIdentityWork(): void {
  const reason = new AuthSessionTransitionError()
  activeControllers.forEach((controller) => controller.abort(reason))
  activeControllers.clear()
  activeClosers.forEach((close) => close())
  activeClosers.clear()
}

export function beginAuthSessionTransition(): void {
  if (transitionState === "synchronizing") return
  stopOldIdentityWork()
  transitionState = "synchronizing"
  transitionEpoch += 1
}

export function blockAuthSessionTransition(): void {
  stopOldIdentityWork()
  if (transitionState !== "blocked") {
    transitionState = "blocked"
    transitionEpoch += 1
  }
}

export function completeAuthSessionTransition(): void {
  if (transitionState !== "stable") {
    transitionState = "stable"
    transitionEpoch += 1
  }
}

export function getAuthSessionTransitionState(): AuthSessionTransitionState {
  return transitionState
}

export function captureAuthSessionEpoch(): number {
  assertAuthSessionStable()
  return transitionEpoch
}

export function assertAuthSessionStable(expectedEpoch?: number): void {
  if (
    transitionState !== "stable" ||
    (expectedEpoch !== undefined && expectedEpoch !== transitionEpoch)
  ) {
    throw new AuthSessionTransitionError()
  }
}

export function registerAuthBoundController(controller: AbortController, expectedEpoch?: number): {
  epoch: number
  release: () => void
} {
  assertAuthSessionStable(expectedEpoch)
  activeControllers.add(controller)
  const epoch = transitionEpoch
  return {
    epoch,
    release: () => activeControllers.delete(controller),
  }
}

export function registerAuthBoundCloser(close: () => void, expectedEpoch?: number): () => void {
  try {
    assertAuthSessionStable(expectedEpoch)
  } catch (error) {
    close()
    throw error
  }
  activeClosers.add(close)
  return () => activeClosers.delete(close)
}

export function resetAuthSessionTransitionForTests(): void {
  activeControllers.clear()
  activeClosers.clear()
  transitionState = "stable"
  transitionEpoch = 0
}
