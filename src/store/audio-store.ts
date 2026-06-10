import { create } from "zustand"
import { getMediaTicket, getMediaTicketSync } from "@/lib/media-ticket"
import { appendMediaToken } from "@/lib/media-url"

// 媒体鉴权恢复的重试上限：token 过期/缺失导致代理 401 时刷新并重载，但限制次数，避免非
// 鉴权错误（解码失败、资源不存在）下无限重载。单例 store，模块级计数即可；新 src 时重置。
const MAX_MEDIA_AUTH_RETRIES = 2
let mediaAuthRetries = 0

// 播放意图：用户是否想播放当前媒体。play() 置 true、pause()/stop() 置 false、setSource 切到
// 新媒体或 registerAudio 重新注册元素时重置为 false。冷启动（同步票据为空 → 首次 src 不带
// token → 代理 401）下，token 异步就绪后据此决定是否自动续播，修复「首次点击无反应、需再点一次」。
let intendToPlay = false

// 回落播放源（公开页 OSS 预签名直链场景，opt-in）：setSource 第 4 参登记。当前 src（直链，
// appendMediaToken 对其 no-op）播放失败触发 reloadWithFreshToken 时，换票对直链无意义——
// 一次性切到这里登记的代理路径（走既有媒体票/换票重试链）。私有页从不登记，行为零变化。
let fallbackSrc: string | null = null

// token 刷新重建的互斥标志：冷启动 401 时，applyAuthorizedSrc 的 warm-up 与 <audio> error 事件
// 触发的 reloadWithFreshToken 会几乎同时拿到（去重后的）同一张短票。用此标志让先到者独占重建
// src，后到者让步，保证一次冷启动只产生一轮 load()/play()，而非两三轮互相 abort、白耗重试额度。
// 媒体重新就绪或再次失败（loadedmetadata|error）后释放。
let recovering = false

// 「正在查看的任务」上下文：全局键盘快捷键（空格切播放、方向键 seek）默认作用于 store 当前载入
// 的音频（即顶部播放条）。但用户停留在某个任务详情页时，期望快捷键作用于正在看的任务，而非播放条
// 里别的任务。详情页挂载时登记 ensureCurrent；快捷键触发前先调用它，若 store 当前源不是本页任务
// 则切源到本页任务（随后 toggle 即播本页任务）。详情页卸载后回落为 null，快捷键恢复全局播放条行为。
let ensureCurrentMedia: (() => void) | null = null

export function setEnsureCurrentMedia(fn: (() => void) | null): void {
  ensureCurrentMedia = fn
}

export function ensureCurrentMediaActive(): void {
  ensureCurrentMedia?.()
}

interface AudioStore {
  audioEl: HTMLAudioElement | null
  src: string | null
  title: string | null
  currentTime: number
  duration: number
  isPlaying: boolean
  taskId: string | null
  registerAudio: (el: HTMLAudioElement | null) => void
  setSource: (
    src: string | null,
    taskId?: string | null,
    title?: string | null,
    fallback?: string | null
  ) => void
  play: () => void
  pause: () => void
  stop: () => void
  toggle: () => void
  seek: (time: number) => void
  setDuration: (duration: number) => void
  setCurrentTime: (time: number) => void
  setIsPlaying: (playing: boolean) => void
  reloadWithFreshToken: () => Promise<void>
}

export const useAudioStore = create<AudioStore>((set, get) => {
  // 媒体代理需鉴权；<audio> 无法带 Authorization 头，故把短票拼到 URL 的 ?token=。
  // state.src 始终是不含 token 的逻辑 URL，仅写入 DOM 时附加。同步缓存命中即同步附加；
  // 冷启动（同步缓存为空）时先写当前(可能不带 token)的 src，再异步取短票重写并按意图续播。
  // 标记一轮 token 刷新重建开始，并在媒体重新就绪/失败后释放互斥标志（once 监听用完即摘）。
  const beginRecovery = (audioEl: HTMLAudioElement) => {
    recovering = true
    const release = () => {
      recovering = false
    }
    audioEl.addEventListener("loadedmetadata", release, { once: true })
    audioEl.addEventListener("error", release, { once: true })
  }

  const applyAuthorizedSrc = (audioEl: HTMLAudioElement, src: string) => {
    const sync = getMediaTicketSync()
    audioEl.src = appendMediaToken(src, sync)
    audioEl.load()
    if (sync) return
    // 非代理 URL（OSS 预签名直链等）：媒体票与之无关，appendMediaToken 恒为 no-op。
    // 跳过异步补票 warm-up，避免用同一 URL 重写 src + 多余 load() 打断刚起的播放。
    if (appendMediaToken(src, "probe") === src) return
    void getMediaTicket().then((token) => {
      if (!token) return
      const cur = get()
      // 期间已切换/清空媒体或换了元素，则放弃本次重写。
      if (cur.audioEl !== audioEl || cur.src !== src) return
      // 已有刷新周期在跑（error → reloadWithFreshToken），让它独占，避免并发 load()/play() 互相 abort。
      if (recovering) return
      // 重试额度已耗尽（如 YouTube key 尚未生成的真 404），不再补播，避免对坏媒体反复 play。
      if (mediaAuthRetries >= MAX_MEDIA_AUTH_RETRIES) return
      beginRecovery(audioEl)
      audioEl.src = appendMediaToken(src, token)
      audioEl.load()
      if (intendToPlay) cur.play()
    })
  }

  return {
    audioEl: null,
    src: null,
    title: null,
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    taskId: null,
    registerAudio: (el) => {
      set({ audioEl: el })
      const { src } = get()
      // 重新注册音频元素不是播放意图：清掉可能残留的 intendToPlay（自然播放结束不触发 pause，
      // 不会清意图），避免重注册 + 冷票据缓存下 warm-up 无用户手势自动续播。
      intendToPlay = false
      if (el && src) applyAuthorizedSrc(el, src)
    },
    setSource: (src, taskId, title, fallback) => {
      const { audioEl, src: previous } = get()
      if (src === previous) {
        if (taskId !== undefined || title !== undefined) {
          set((state) => ({
            taskId: taskId ?? state.taskId,
            title: title ?? state.title,
          }))
        }
        return
      }
      // 切换到新媒体：重置鉴权恢复计数、互斥标志与播放意图，避免上一条媒体的额度/在途恢复/意图
      // 殃及新媒体（仅 play() 才会重新置 intendToPlay；seek 等不带播放意图的换源不应自动播放）。
      // 回落源同时重登记：不传（私有页）即清空，上一条媒体的回落绝不能殃及新媒体。
      mediaAuthRetries = 0
      recovering = false
      intendToPlay = false
      fallbackSrc = fallback ?? null
      set({
        src,
        title: title ?? null,
        currentTime: 0,
        duration: 0,
        isPlaying: false,
        taskId: taskId ?? null,
      })
      if (audioEl && src) applyAuthorizedSrc(audioEl, src)
    },
    play: () => {
      const { audioEl } = get()
      if (!audioEl) return
      intendToPlay = true
      audioEl.play().then(
        () => set({ isPlaying: true }),
        () => set({ isPlaying: false })
      )
    },
    pause: () => {
      intendToPlay = false
      const { audioEl } = get()
      if (audioEl) {
        audioEl.pause()
      }
      set({ isPlaying: false })
    },
    stop: () => {
      intendToPlay = false
      fallbackSrc = null
      const { audioEl } = get()
      if (audioEl) {
        audioEl.pause()
        audioEl.removeAttribute("src")
        audioEl.load()
      }
      set({ src: null, title: null, taskId: null, currentTime: 0, duration: 0, isPlaying: false })
    },
    toggle: () => {
      const { audioEl } = get()
      if (!audioEl) return
      if (audioEl.paused) {
        get().play()
      } else {
        get().pause()
      }
    },
    seek: (time) => {
      const { audioEl } = get()
      if (audioEl) {
        audioEl.currentTime = time
      }
      set({ currentTime: time })
    },
    setDuration: (duration) => set({ duration }),
    setCurrentTime: (currentTime) => set({ currentTime }),
    setIsPlaying: (isPlaying) => set({ isPlaying }),
    // 媒体票据过期/缺失导致代理 401 时，<audio> 的 error 事件会触发这里：用异步
    // getMediaTicket()（命中缓存或重新签发）取短票重建 src 并重载，保留进度后按播放意图续播。
    // 带重试上限，避免解码失败 / 资源不存在等非鉴权错误下无限重载。首次冷启动（同步缓存为空、
    // src 不带 token、play() 已把 intendToPlay 置 true 但元素仍 paused）的 401 也由这条路径兜底续播。
    reloadWithFreshToken: async () => {
      const { audioEl, src } = get()
      if (!audioEl || !src) return
      // warm-up 已在重建同一条媒体（冷启动竞态），让它独占，避免本路径再消耗一次重试额度并并发 load()。
      if (recovering) return
      // 登记过回落源且当前源还不是它（公开页 OSS 直链失败，如预签名过期 403）：一次性切到代理
      // 回落路径并重置重试额度——回落源是另一条媒体路径，应享有完整的换票重试预算；后续走下方
      // 既有「取票重建 src + 保留进度续播」链。私有页 fallbackSrc 恒为 null，此分支不可达。
      let target = src
      if (fallbackSrc && fallbackSrc !== src) {
        target = fallbackSrc
        fallbackSrc = null
        mediaAuthRetries = 0
        set({ src: target })
      }
      if (mediaAuthRetries >= MAX_MEDIA_AUTH_RETRIES) return
      mediaAuthRetries += 1
      recovering = true

      const resumeAt = audioEl.currentTime
      const wasPlaying = !audioEl.paused

      const token = await getMediaTicket()
      audioEl.src = appendMediaToken(target, token)
      audioEl.load()

      // 本轮重建只结算一次：loadedmetadata（成功）与 error（仍失败）先到者胜，另一个 once 监听
      // 即便后到也被 settled 拦掉。无论成败都释放互斥标志，避免 recovering 永久卡死。
      let settled = false
      const onReady = () => {
        if (settled) return
        settled = true
        recovering = false
        mediaAuthRetries = 0
        if (resumeAt > 0 && Number.isFinite(resumeAt)) {
          audioEl.currentTime = resumeAt
        }
        // 原本在播 或 用户本就想播（冷启动首次点击失败后元素仍 paused）→ 续播。
        if (wasPlaying || intendToPlay) {
          audioEl.play().catch(() => {})
        }
      }
      const onFail = () => {
        if (settled) return
        settled = true
        // 重建后仍失败（非鉴权错误，如真 404）：释放互斥标志，cap 会在下次拦截，避免死循环重载。
        recovering = false
      }
      audioEl.addEventListener("loadedmetadata", onReady, { once: true })
      audioEl.addEventListener("error", onFail, { once: true })
    },
  }
})
