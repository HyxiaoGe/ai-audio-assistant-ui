/**
 * TranscriptView Component
 * Displays transcript segments with speaker labels and timestamps
 */

"use client"

import { useMemo, useState, useEffect } from "react"
import { MessageSquare, Search, Users } from "lucide-react"
import { useAPIClient } from "@/lib/use-api-client"
import type { TranscriptSegment } from "@/types/api"
import { useI18n } from "@/lib/i18n-context"

interface TranscriptViewProps {
  taskId: string
}

function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`
}

export function TranscriptView({ taskId }: TranscriptViewProps) {
  const client = useAPIClient()
  const { t } = useI18n()
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    const loadTranscript = async () => {
      try {
        setLoading(true)
        const result = await client.getTranscript(taskId)
        setSegments(result.items)
      } catch (err) {
        setError(err instanceof Error ? err.message : t("errors.loadTranscriptFailed"))
      } finally {
        setLoading(false)
      }
    }

    loadTranscript()
  }, [client, taskId, t])

  // Filter segments by search query
  const filteredSegments = searchQuery
    ? segments.filter((seg) =>
        seg.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : segments

  const speakerLabels = useMemo(() => {
    const ids = Array.from(
      new Set(segments.map((s) => s.speaker_id).filter(Boolean))
    ) as string[]
    ids.sort()
    const palette = [
      t("transcript.speakerA"),
      t("transcript.speakerB"),
      t("transcript.speakerC"),
      t("transcript.speakerD"),
      t("transcript.speakerE"),
    ]
    const map = new Map<string, string>()
    ids.forEach((id, index) => {
      map.set(id, palette[index] || id)
    })
    return map
  }, [segments, t])

  const speakerCount = speakerLabels.size
  const unknownSpeakerLabel = t("transcript.unknownSpeaker")

  if (loading) {
    return (
      <div
        className="glass-panel p-8 rounded-lg text-center"
      >
        <div
          className="inline-block size-8 border-4 border-[var(--app-primary)] border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "var(--app-primary) transparent var(--app-primary) var(--app-primary)" }}
        />
        <p className="mt-4 text-sm" style={{ color: "var(--app-text-muted)" }}>
          {t("transcript.loading")}
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="glass-panel p-8 rounded-lg"
        style={{
          backgroundColor: "var(--app-danger-bg-soft)",
          border: "1px solid var(--app-danger-bg)",
        }}
      >
        <p style={{ color: "var(--app-danger)" }}>{error}</p>
      </div>
    )
  }

  if (segments.length === 0) {
    return (
      <div
        className="glass-panel p-8 rounded-lg text-center"
      >
        <MessageSquare
          className="size-12 mx-auto mb-4"
          style={{ color: "var(--app-text-subtle)" }}
        />
        <p className="text-lg font-medium" style={{ color: "var(--app-text-muted)" }}>
          {t("transcript.empty")}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with search */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-5" style={{ color: "var(--app-primary)" }} />
          <h2 className="text-xl font-semibold" style={{ color: "var(--app-text)" }}>
            {t("transcript.title")}
          </h2>
          <span
            className="glass-chip text-sm px-2 py-1 rounded"
          >
            {t("transcript.totalCount", { count: segments.length })}
          </span>
        </div>

        {/* Speaker count */}
        {speakerCount > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="size-4" style={{ color: "var(--app-text-muted)" }} />
            <span style={{ color: "var(--app-text-muted)" }}>
              {t("transcript.speakerCount", { count: speakerCount })}
            </span>
          </div>
        )}
      </div>

      {/* Search bar */}
      <div className="relative max-w-md">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <Search className="size-5" style={{ color: "var(--app-text-subtle)" }} />
        </div>
        <input
          type="text"
          placeholder={t("transcript.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="glass-control w-full pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--app-primary)]"
          style={{ color: "var(--app-text)" }}
        />
        {searchQuery && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <button
              onClick={() => setSearchQuery("")}
              className="glass-chip text-xs px-2 py-1 rounded"
              style={{ color: "var(--app-text-subtle)" }}
            >
              {t("tasks.clearSearch")}
            </button>
          </div>
        )}
      </div>

      {searchQuery && (
        <p className="text-sm" style={{ color: "var(--app-text-muted)" }}>
          {t("transcript.searchResults", { count: filteredSegments.length })}
        </p>
      )}

      {/* Transcript segments */}
      <div className="space-y-3">
        {filteredSegments.map((segment) => (
          <div
            key={segment.id}
            className="glass-item p-4 rounded-lg"
          >
            {/* Header with timestamp and speaker */}
            <div className="flex items-center gap-3 mb-2">
              <span
                className="glass-chip text-xs font-mono tabular-nums px-2 py-1 rounded"
              >
                {formatTimestamp(segment.start_time)}
              </span>
              <span
                className="text-xs font-medium px-2 py-1 rounded"
                style={{
                  backgroundColor: "var(--app-primary-soft)",
                  color: "var(--app-primary)",
                }}
              >
                {segment.speaker_id ? speakerLabels.get(segment.speaker_id) || segment.speaker_id : unknownSpeakerLabel}
              </span>
              {segment.is_edited && (
                <span
                  className="text-xs px-2 py-1 rounded"
                  style={{
                    backgroundColor: "var(--app-warning-bg)",
                    color: "var(--app-warning-strong)",
                  }}
                >
                  {t("transcript.edited")}
                </span>
              )}
            </div>

            {/* Content */}
            <p className="text-base leading-relaxed" style={{ color: "var(--app-text)" }}>
              {segment.content}
            </p>

            {/* Confidence score */}
            {segment.confidence !== null && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs" style={{ color: "var(--app-text-subtle)" }}>
                  {t("transcript.confidence")}
                </span>
                <div className="flex-1 max-w-24 h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: "var(--app-glass-border)" }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${segment.confidence * 100}%`,
                      backgroundColor:
                        segment.confidence >= 0.8
                          ? "var(--app-success)"
                          : segment.confidence >= 0.6
                            ? "var(--app-warning)"
                            : "var(--app-danger)",
                    }}
                  />
                </div>
                <span className="text-xs tabular-nums" style={{ color: "var(--app-text-muted)" }}>
                  {(segment.confidence * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredSegments.length === 0 && searchQuery && (
        <div
          className="glass-panel p-8 rounded-lg text-center"
        >
          <Search className="size-12 mx-auto mb-4" style={{ color: "var(--app-text-subtle)" }} />
          <p className="text-lg font-medium" style={{ color: "var(--app-text-muted)" }}>
            {t("transcript.noMatchTitle")}
          </p>
          <p className="text-sm mt-2" style={{ color: "var(--app-text-subtle)" }}>
            {t("transcript.noMatchDesc")}
          </p>
        </div>
      )}
    </div>
  )
}
