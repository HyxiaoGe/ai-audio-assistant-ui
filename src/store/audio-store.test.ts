import { beforeEach, describe, expect, it, vi } from "vitest"

// 音频 src 在 registerAudio / setSource 时用 getMediaTicketSync()（不签发）把短票烧进 URL。
// 票过期/缺失后媒体代理 401，播放静默失败且无恢复（GlobalAudioPlayer 原本没有 onError）。
// 这里锁定：reloadWithFreshToken 必须用异步 getMediaTicket() 取短票重建 src 并重载，
// 保留进度并按原播放态续播，且带重试上限防止非鉴权错误下无限重载。
const ticket = vi.hoisted(() => ({
  getMediaTicketSync: vi.fn((): string | null => "old"),
  getMediaTicket: vi.fn(async (): Promise<string | null> => "fresh"),
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
    pause: vi.fn(),
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
    el.emit("error") // 重建后仍失败：释放互斥标志（保留重试计数），让下一次 reload 能继续推进
    await useAudioStore.getState().reloadWithFreshToken()
    el.emit("error")
    const callsAtCap = ticket.getMediaTicket.mock.calls.length

    await useAudioStore.getState().reloadWithFreshToken() // 超过上限：不应再签发新票

    expect(ticket.getMediaTicket.mock.calls.length).toBe(callsAtCap)
  })
})

// 冷启动竞态：页面首开时同步票据缓存常为空（异步签发尚未回来），setSource 写入 DOM 时
// getMediaTicketSync() 返回 null → src 不带 token → 代理 401。锁定：冷缓存下 setSource 异步
// 取短票重写 src，并仅在用户有播放意图（play() 调用过）时自动续播；无意图（如 seek）不自动播。
describe("audio-store cold-cache token warm-up", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ticket.getMediaTicketSync.mockReturnValue("old")
    ticket.getMediaTicket.mockResolvedValue("fresh")
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

  it("warms the token async and resumes play when the user intended to play", async () => {
    ticket.getMediaTicketSync.mockReturnValue(null) // 冷缓存
    const el = fakeAudio()
    useAudioStore.getState().registerAudio(el as unknown as HTMLAudioElement)
    useAudioStore.getState().setSource("/api/v1/media/clip")
    useAudioStore.getState().play() // 有播放意图
    el.play.mockClear()

    await Promise.resolve()
    await Promise.resolve()

    expect(el.src).toBe("/api/v1/media/clip?token=fresh") // 异步取到短票后重写 src
    expect(el.play).toHaveBeenCalledTimes(1) // 续播一次
  })

  it("warms the token but does NOT auto-play without a play intent (e.g. seek-only)", async () => {
    ticket.getMediaTicketSync.mockReturnValue(null) // 冷缓存
    const el = fakeAudio()
    useAudioStore.getState().registerAudio(el as unknown as HTMLAudioElement)
    useAudioStore.getState().setSource("/api/v1/media/clip") // 未调用 play()

    await Promise.resolve()
    await Promise.resolve()

    expect(el.src).toBe("/api/v1/media/clip?token=fresh") // 仍把 token 补上
    expect(el.play).not.toHaveBeenCalled() // 但不自动播
  })

  it("recovery resumes when play was intended even though the element is paused (cold-start 401)", async () => {
    const el = fakeAudio() // paused = true
    useAudioStore.getState().registerAudio(el as unknown as HTMLAudioElement)
    useAudioStore.getState().setSource("/api/v1/media/clip") // 热票，不走异步 warm
    useAudioStore.getState().play() // intendToPlay = true；fake 元素仍 paused
    el.play.mockClear()

    await useAudioStore.getState().reloadWithFreshToken()
    el.emit("loadedmetadata")

    expect(el.play).toHaveBeenCalled() // wasPlaying=false 但 intendToPlay=true → 续播
  })

  it("recovery does NOT resume after the user paused (intent cleared)", async () => {
    const el = fakeAudio()
    useAudioStore.getState().registerAudio(el as unknown as HTMLAudioElement)
    useAudioStore.getState().setSource("/api/v1/media/clip")
    useAudioStore.getState().play()
    useAudioStore.getState().pause() // intendToPlay = false
    el.play.mockClear()

    await useAudioStore.getState().reloadWithFreshToken()
    el.emit("loadedmetadata")

    expect(el.play).not.toHaveBeenCalled()
  })

  // 冷启动 401 双触发：无 token 的 src 在真实浏览器会 401，使 warm-up 的补票重写与 <audio>
  // error→reloadWithFreshToken 同时发生。锁定：reloadWithFreshToken 先置 recovering，warm-up
  // 让步，一次冷启动只产生一轮 load()/play()（setSource 的无 token src + reload 的带 token src），
  // 而非两三轮互相 abort、白耗重试额度。
  it("defers the warm-up to an in-flight reloadWithFreshToken so a cold-start 401 rebuilds once", async () => {
    ticket.getMediaTicketSync.mockReturnValue(null) // 冷缓存 → setSource 触发异步 warm-up
    const el = fakeAudio()
    useAudioStore.getState().registerAudio(el as unknown as HTMLAudioElement)
    useAudioStore.getState().setSource("/api/v1/media/clip") // load() #1：无 token 的 src
    useAudioStore.getState().play() // intendToPlay = true
    // 浏览器对无 token src 返回 401 → error 事件同步触发 reloadWithFreshToken，
    // 它先于 warm-up 的 then 置 recovering=true，warm-up 据此让步、不再追加重写/load。
    await useAudioStore.getState().reloadWithFreshToken() // load() #2：带新 token 的 src

    expect(el.load).toHaveBeenCalledTimes(2) // 仅两次，warm-up 未追加第三次 load

    el.play.mockClear()
    el.emit("loadedmetadata")
    expect(el.play).toHaveBeenCalledTimes(1) // 由 reload 独占续播一次
  })
})
