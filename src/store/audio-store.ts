import { create } from "zustand"
import { getToken, getTokenSync } from "@/lib/auth-token"
import { appendMediaToken } from "@/lib/media-url"

// 媒体鉴权恢复的重试上限：token 过期 401 时刷新并重载，但限制次数，避免非鉴权错误
// （解码失败、资源不存在）下无限重载。单例 store，模块级计数即可；新 src 时重置。
const MAX_MEDIA_AUTH_RETRIES = 2
let mediaAuthRetries = 0

interface AudioStore {
  audioEl: HTMLAudioElement | null
  src: string | null
  title: string | null
  currentTime: number
  duration: number
  isPlaying: boolean
  taskId: string | null
  registerAudio: (el: HTMLAudioElement | null) => void
  setSource: (src: string | null, taskId?: string | null, title?: string | null) => void
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

export const useAudioStore = create<AudioStore>((set, get) => ({
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
    // 媒体代理需鉴权；<audio> 无法带 Authorization 头，故把 token 拼到 URL 查询串。
    // state.src 保持为不含 token 的逻辑 URL，仅写入 DOM 时附加 token。
    if (el && src) {
      el.src = appendMediaToken(src, getTokenSync())
      el.load()
    }
  },
  setSource: (src, taskId, title) => {
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
    // 切换到新媒体：重置鉴权恢复计数，避免上一条媒体耗尽的重试额度殃及新媒体。
    mediaAuthRetries = 0
    set({
      src,
      title: title ?? null,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      taskId: taskId ?? null,
    })
    if (audioEl && src) {
      audioEl.src = appendMediaToken(src, getTokenSync())
      audioEl.load()
    }
  },
  play: () => {
    const { audioEl } = get()
    if (!audioEl) return
    audioEl.play().then(
      () => set({ isPlaying: true }),
      () => set({ isPlaying: false })
    )
  },
  pause: () => {
    const { audioEl } = get()
    if (audioEl) {
      audioEl.pause()
    }
    set({ isPlaying: false })
  },
  stop: () => {
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
  // token 过期导致媒体代理 401 时，<audio> 的 error 事件会触发这里：用异步 getToken()
  // （会按需刷新）取新 token 重建 src 并重载，保留进度并按原播放态续播。带重试上限，
  // 避免解码失败 / 资源不存在等非鉴权错误下无限重载。
  reloadWithFreshToken: async () => {
    const { audioEl, src } = get()
    if (!audioEl || !src) return
    if (mediaAuthRetries >= MAX_MEDIA_AUTH_RETRIES) return
    mediaAuthRetries += 1

    const resumeAt = audioEl.currentTime
    const wasPlaying = !audioEl.paused

    const token = await getToken()
    audioEl.src = appendMediaToken(src, token)
    audioEl.load()

    const handleReady = () => {
      audioEl.removeEventListener("loadedmetadata", handleReady)
      // 新 token 生效、元数据加载成功 → 恢复成功，重置计数。
      mediaAuthRetries = 0
      if (resumeAt > 0 && Number.isFinite(resumeAt)) {
        audioEl.currentTime = resumeAt
      }
      if (wasPlaying) {
        audioEl.play().catch(() => {})
      }
    }
    audioEl.addEventListener("loadedmetadata", handleReady)
  },
}))
