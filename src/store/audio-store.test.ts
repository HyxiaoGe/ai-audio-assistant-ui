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

// 仿真实现语义：仅同源代理路径且 token 非空才拼 ?token=；OSS 直链(完整 https)/空 token 原样返回。
// 直链回落逻辑依赖这一语义(对直链 no-op)判断「换票无意义」，mock 必须保持一致。
vi.mock("@/lib/media-url", () => ({
  appendMediaToken: (src: string, token: string | null) =>
    token && src.startsWith("/api/v1/") ? `${src}?token=${token}` : src,
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

// 公开页 OSS 预签名音频直链（绕隧道）：setSource 第 4 参登记 audio_url 代理路径为回落源。
// 直链播放失败（预签名过期 403 → <audio> error → reloadWithFreshToken）时换票对直链无意义，
// 应一次性切到回落代理路径、重置重试额度并走既有「取票重建 src + 保留进度续播」链。
// 私有页从不登记回落源（上方既有用例即回归守卫），行为零变化。
describe("audio-store 直链回落（公开页 OSS 预签名直链）", () => {
  const DIRECT = "https://oss.example.com/audio/t1.mp3?Expires=1&Signature=sig"
  const PROXY = "/api/v1/media/upload/u1/t1.mp3"

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
    // 清掉上一用例可能残留的模块级回落登记（stop() 显式置 fallbackSrc=null；
    // setSource(null) 在 src 已为 null 时会早退、清不掉）
    useAudioStore.getState().stop()
  })

  it("直链源原样写入 <audio>（不拼媒体票），且不触发补票 warm-up 重载", async () => {
    ticket.getMediaTicketSync.mockReturnValue(null) // 冷缓存也不该对直链 warm-up
    const el = fakeAudio()
    useAudioStore.getState().registerAudio(el as unknown as HTMLAudioElement)
    useAudioStore.getState().setSource(DIRECT, "t1", "标题", PROXY)

    expect(el.src).toBe(DIRECT) // 完整 https 直链原样作 src

    await Promise.resolve()
    await Promise.resolve()
    expect(ticket.getMediaTicket).not.toHaveBeenCalled() // 媒体票与直链无关
    expect(el.load).toHaveBeenCalledTimes(1) // 无第二次 warm-up 重载
  })

  it("直链 error → 一次性切到登记的代理回落源，换票重载并保留进度续播", async () => {
    const el = fakeAudio()
    useAudioStore.getState().registerAudio(el as unknown as HTMLAudioElement)
    useAudioStore.getState().setSource(DIRECT, "t1", "标题", PROXY)
    el.currentTime = 30
    el.paused = false
    el.load.mockClear()

    await useAudioStore.getState().reloadWithFreshToken() // <audio> error 链路入口

    expect(useAudioStore.getState().src).toBe(PROXY) // 逻辑源已回落为代理路径
    expect(el.src).toBe(`${PROXY}?token=fresh`) // 代理路径走既有票链
    expect(el.load).toHaveBeenCalledTimes(1)

    el.currentTime = 0 // 模拟 load 后进度归零
    el.emit("loadedmetadata")
    expect(el.currentTime).toBe(30) // 进度保留
    expect(el.play).toHaveBeenCalled() // 原本在播 → 续播
  })

  it("回落只发生一次：回落源上的后续失败走既有换票重试链直至 cap，不再切换", async () => {
    const el = fakeAudio()
    useAudioStore.getState().registerAudio(el as unknown as HTMLAudioElement)
    useAudioStore.getState().setSource(DIRECT, "t1", "标题", PROXY)

    await useAudioStore.getState().reloadWithFreshToken() // 回落切换（额度重置后消耗 1）
    el.emit("error")
    await useAudioStore.getState().reloadWithFreshToken() // 回落源上重试 #2
    el.emit("error")
    expect(useAudioStore.getState().src).toBe(PROXY) // 始终停留在回落源
    const callsAtCap = ticket.getMediaTicket.mock.calls.length

    await useAudioStore.getState().reloadWithFreshToken() // 超过上限：不再签发新票
    expect(ticket.getMediaTicket.mock.calls.length).toBe(callsAtCap)
  })

  it("切换到新源会清掉上一条媒体的回落登记，绝不殃及新媒体", async () => {
    const el = fakeAudio()
    useAudioStore.getState().registerAudio(el as unknown as HTMLAudioElement)
    useAudioStore.getState().setSource(DIRECT, "t1", "标题", PROXY)
    useAudioStore.getState().setSource("/api/v1/media/other.mp3", "t2", "另一条") // 未登记回落

    await useAudioStore.getState().reloadWithFreshToken()

    expect(useAudioStore.getState().src).toBe("/api/v1/media/other.mp3") // 不被旧回落源劫持
    expect(el.src).toBe("/api/v1/media/other.mp3?token=fresh")
  })
})
