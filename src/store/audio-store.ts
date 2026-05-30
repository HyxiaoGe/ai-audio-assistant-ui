import { create } from "zustand"
import { getTokenSync } from "@/lib/auth-token"
import { appendMediaToken } from "@/lib/media-url"

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
}))
