"use client"

import { useCallback, useEffect, useRef } from "react"
import { ensureCurrentMediaActive, useAudioStore } from "@/store/audio-store"
import { canonicalizeAudioSrc } from "@/lib/audio-progress"

const CACHE_TTL = 7 * 24 * 60 * 60 * 1000
const PERSIST_INTERVAL_MS = 1000

export default function GlobalAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastPersistRef = useRef(0)
  const registerAudio = useAudioStore((state) => state.registerAudio)
  const src = useAudioStore((state) => state.src)
  const taskId = useAudioStore((state) => state.taskId)
  const setDuration = useAudioStore((state) => state.setDuration)
  const setCurrentTime = useAudioStore((state) => state.setCurrentTime)
  const setIsPlaying = useAudioStore((state) => state.setIsPlaying)
  const reloadWithFreshToken = useAudioStore((state) => state.reloadWithFreshToken)
  const getAudioState = useAudioStore.getState

  const cacheKey = taskId ? `audio:progress:${taskId}` : null

  const persistProgress = useCallback(() => {
    if (!cacheKey || !audioRef.current) return
    const audio = audioRef.current
    const payload = {
      time: audio.currentTime,
      updatedAt: Date.now(),
      // 存归一化后的 pathname：跨会话稳定、与 store.src 可比，且不把 token 写进 localStorage。
      src: canonicalizeAudioSrc(audio.src) ?? audio.src,
    }
    try {
      localStorage.setItem(cacheKey, JSON.stringify(payload))
    } catch {
      // Ignore storage errors
    }
  }, [cacheKey])

  const persistProgressThrottled = useCallback(() => {
    const now = Date.now()
    if (now - lastPersistRef.current < PERSIST_INTERVAL_MS) return
    lastPersistRef.current = now
    persistProgress()
  }, [persistProgress])

  const clearProgress = useCallback(() => {
    if (!cacheKey) return
    try {
      localStorage.removeItem(cacheKey)
    } catch {
      // Ignore storage errors
    }
  }, [cacheKey])

  useEffect(() => {
    registerAudio(audioRef.current)
    return () => registerAudio(null)
  }, [registerAudio])

  useEffect(() => {
    if (!cacheKey || !audioRef.current || !src) return
    try {
      const cached = localStorage.getItem(cacheKey)
      if (!cached) return
      const parsed = JSON.parse(cached) as {
        time?: number
        updatedAt?: number
        src?: string
      }
      // 两侧都归一到 pathname 再比较：兼容旧的绝对+token 持久值，也兼容相对的 store.src。
      if (!parsed || canonicalizeAudioSrc(parsed.src) !== canonicalizeAudioSrc(src)) return
      if (!parsed.updatedAt || Date.now() - parsed.updatedAt > CACHE_TTL) {
        clearProgress()
        return
      }
      if (typeof parsed.time === "number" && isFinite(parsed.time)) {
        audioRef.current.currentTime = parsed.time
        setCurrentTime(parsed.time)
        setIsPlaying(false)
      }
    } catch {
      // Ignore storage errors
    }
  }, [cacheKey, clearProgress, src, setCurrentTime, setIsPlaying])

  // 注意：audio 元素的 src 由 audio-store（registerAudio / setSource）统一设置，
  // 并在写入时附加鉴权 token（见 audio-store）。此处不再单独赋值，避免重复 load。

  const handleLoadedMetadata = () => {
    const duration = audioRef.current?.duration
    if (duration && !isNaN(duration) && isFinite(duration)) {
      setDuration(duration)
    }
  }

  const handleTimeUpdate = () => {
    const time = audioRef.current?.currentTime
    if (time !== undefined && !isNaN(time)) {
      setCurrentTime(time)
      persistProgressThrottled()
    }
  }

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        persistProgress()
      }
    }
    const handleBeforeUnload = () => {
      persistProgress()
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [persistProgress])

  useEffect(() => {
    const isInteractiveTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      if (target.isContentEditable) return true
      const selector = [
        "input",
        "textarea",
        "select",
        "button",
        "a",
        "[role='button']",
        "[role='link']",
        "[role='textbox']",
        "[role='menuitem']",
        "[role='option']",
        "[role='switch']",
        "[role='checkbox']",
      ].join(",")
      return Boolean(target.closest(selector))
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isInteractiveTarget(event.target)) return

      const key = event.key
      const isPlayPause = key === " " || event.code === "Space"
      const isSeek = key === "ArrowLeft" || key === "ArrowRight"
      if (!isPlayPause && !isSeek) return

      if (isPlayPause) {
        // 空格作用于用户正在看的任务：详情页登记了上下文时先确保 store 指向本页任务（必要时切源，
        // store 为空也能直接起播本页任务），再 toggle，避免误操作顶部播放条里别的任务。
        ensureCurrentMediaActive()
        const { src, toggle } = getAudioState()
        if (!src) return
        event.preventDefault()
        toggle()
        return
      }

      // 方向键 seek 只作用于当前正在播放/载入的音频（顶部播放条），不切换任务——
      // 否则在详情页按方向键会意外打断正在听的另一任务。
      const { src, seek, currentTime, duration } = getAudioState()
      if (!src) return
      event.preventDefault()
      const step = 5
      const delta = key === "ArrowLeft" ? -step : step
      const max = duration > 0 && isFinite(duration) ? duration : Number.POSITIVE_INFINITY
      const next = Math.max(0, Math.min(max, currentTime + delta))
      seek(next)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [getAudioState])

  return (
    <audio
      ref={audioRef}
      preload="metadata"
      crossOrigin="anonymous"
      onLoadedMetadata={handleLoadedMetadata}
      onTimeUpdate={handleTimeUpdate}
      onPlay={() => setIsPlaying(true)}
      onPause={() => {
        setIsPlaying(false)
        persistProgress()
      }}
      onSeeked={() => {
        persistProgress()
      }}
      onEnded={() => {
        setIsPlaying(false)
        clearProgress()
      }}
      // 媒体代理鉴权基于 URL 上的 token；token 过期会让请求 401，<audio> 随即触发 error。
      // 交给 store 用新 token 重建 src 并重载（保留进度、按原播放态续播，带重试上限）。
      onError={() => {
        void reloadWithFreshToken()
      }}
    />
  )
}
