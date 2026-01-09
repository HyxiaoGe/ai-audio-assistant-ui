"use client"

import { useEffect, useRef } from "react"
import { useAudioStore } from "@/store/audio-store"

export default function GlobalAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const registerAudio = useAudioStore((state) => state.registerAudio)
  const src = useAudioStore((state) => state.src)
  const setDuration = useAudioStore((state) => state.setDuration)
  const setCurrentTime = useAudioStore((state) => state.setCurrentTime)
  const setIsPlaying = useAudioStore((state) => state.setIsPlaying)

  useEffect(() => {
    registerAudio(audioRef.current)
    return () => registerAudio(null)
  }, [registerAudio])

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
    }
  }

  return (
    <audio
      ref={audioRef}
      preload="metadata"
      crossOrigin="anonymous"
      onLoadedMetadata={handleLoadedMetadata}
      onTimeUpdate={handleTimeUpdate}
      onPlay={() => setIsPlaying(true)}
      onPause={() => setIsPlaying(false)}
      onEnded={() => setIsPlaying(false)}
    />
  )
}
