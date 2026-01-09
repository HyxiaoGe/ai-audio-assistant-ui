"use client"

import { useCallback, useEffect, useRef } from "react"
import { useAudioStore } from "@/store/audio-store"

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
  const getAudioState = useAudioStore.getState

  const cacheKey = taskId ? `audio:progress:${taskId}` : null

  const persistProgress = useCallback(() => {
    if (!cacheKey || !audioRef.current) return
    const audio = audioRef.current
    const payload = {
      time: audio.currentTime,
      updatedAt: Date.now(),
      src: audio.src,
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
      if (!parsed || parsed.src !== src) return
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
  }, [cacheKey, src, setCurrentTime, setIsPlaying])

  useEffect(() => {
    if (!audioRef.current || !src) return
    if (audioRef.current.src !== src) {
      audioRef.current.src = src
      audioRef.current.load()
    }
  }, [src])

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

      const { src, toggle, seek, currentTime, duration } = getAudioState()
      if (!src) return

      const key = event.key
      if (key === " " || event.code === "Space") {
        event.preventDefault()
        toggle()
        return
      }

      if (key === "ArrowLeft" || key === "ArrowRight") {
        event.preventDefault()
        const step = 5
        const delta = key === "ArrowLeft" ? -step : step
        const max = duration > 0 && isFinite(duration) ? duration : Number.POSITIVE_INFINITY
        const next = Math.max(0, Math.min(max, currentTime + delta))
        seek(next)
      }
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
    />
  )
}
