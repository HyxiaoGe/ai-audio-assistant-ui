import { beforeEach, describe, expect, it, vi } from "vitest"

// 音频 src 在 registerAudio / setSource 时用 getMediaTicketSync()（不签发）把短票烧进 URL。
// 票过期/缺失后媒体代理 401，播放静默失败且无恢复（GlobalAudioPlayer 原本没有 onError）。
// 这里锁定：reloadWithFreshToken 必须用异步 getMediaTicket() 取短票重建 src 并重载，
// 保留进度并按原播放态续播，且带重试上限防止非鉴权错误下无限重载。
const ticket = vi.hoisted(() => ({
  getMediaTicketSync: vi.fn(() => "old"),
  getMediaTicket: vi.fn(async () => "fresh"),
}))

vi.mock("@/lib/media-ticket", () => ({
  getMediaTicketSync: ticket.getMediaTicketSync,
  getMediaTicket: ticket.getMediaTicket,
}))

vi.mock("@/lib/media-url", () => ({
  appendMediaToken: (src: string, token: string | null) => `${src}?token=${token}`,
}))

import { useAudioStore } from "./audio-store"

function fakeAudio() {
  const listeners: Record<string, Array<() => void>> = {}
  return {
    src: "",
    currentTime: 0,
    paused: true,
    load: vi.fn(),
    play: vi.fn(() => Promise.resolve()),
    addEventListener: vi.fn((type: string, cb: () => void) => {
      ;(listeners[type] ||= []).push(cb)
    }),
    removeEventListener: vi.fn((type: string, cb: () => void) => {
      listeners[type] = (listeners[type] || []).filter((l) => l !== cb)
    }),
    emit: (type: string) => (listeners[type] || []).forEach((cb) => cb()),
  }
}

describe("audio-store reloadWithFreshToken", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAudioStore.setState({
      audioEl: null,
      src: null,
      taskId: null,
      title: null,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
    })
  })

  it("rebuilds the element src with a freshly-refreshed token and reloads", async () => {
    const el = fakeAudio()
    useAudioStore.getState().registerAudio(el as unknown as HTMLAudioElement)
    useAudioStore.getState().setSource("/api/v1/media/clip")
    el.load.mockClear()

    await useAudioStore.getState().reloadWithFreshToken()

    expect(ticket.getMediaTicket).toHaveBeenCalled()
    expect(el.src).toBe("/api/v1/media/clip?token=fresh")
    expect(el.load).toHaveBeenCalledTimes(1)
  })

  it("restores the playback position and resumes when it was playing", async () => {
    const el = fakeAudio()
    el.currentTime = 42
    el.paused = false
    useAudioStore.getState().registerAudio(el as unknown as HTMLAudioElement)
    useAudioStore.getState().setSource("/api/v1/media/clip")

    await useAudioStore.getState().reloadWithFreshToken()
    el.currentTime = 0 // 模拟 load 后进度归零
    el.emit("loadedmetadata")

    expect(el.currentTime).toBe(42)
    expect(el.play).toHaveBeenCalled()
  })

  it("stops attempting recovery after the retry cap to avoid infinite reload loops", async () => {
    const el = fakeAudio()
    useAudioStore.getState().registerAudio(el as unknown as HTMLAudioElement)
    useAudioStore.getState().setSource("/api/v1/media/clip")

    await useAudioStore.getState().reloadWithFreshToken()
    await useAudioStore.getState().reloadWithFreshToken()
    const callsAtCap = ticket.getMediaTicket.mock.calls.length

    await useAudioStore.getState().reloadWithFreshToken() // 超过上限：不应再签发新票

    expect(ticket.getMediaTicket.mock.calls.length).toBe(callsAtCap)
  })
})
