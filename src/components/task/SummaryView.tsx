/**
 * SummaryView Component
 * Displays AI-generated summaries with different types
 */

"use client"

import { useState, useEffect, useMemo } from "react"
import {
  FileText,
  Sparkles,
  List,
  CheckSquare,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAPIClient } from "@/lib/use-api-client"
import { useDateFormatter } from "@/lib/use-date-formatter"
import { useI18n } from "@/lib/i18n-context"
import type { LLMModel, SummaryItem, SummaryType } from "@/types/api"

interface SummaryViewProps {
  taskId: string
}

const SUMMARY_TYPE_CONFIG: Record<
  SummaryType,
  {
    labelKey: string
    icon: typeof FileText
    color: string
    bgColor: string
  }
> = {
  overview: {
    labelKey: "summary.type.overview",
    icon: FileText,
    color: "var(--app-primary)",
    bgColor: "var(--app-primary-soft)",
  },
  key_points: {
    labelKey: "summary.type.keyPoints",
    icon: List,
    color: "var(--app-purple)",
    bgColor: "var(--app-purple-bg)",
  },
  action_items: {
    labelKey: "summary.type.actionItems",
    icon: CheckSquare,
    color: "var(--app-success)",
    bgColor: "var(--app-success-bg)",
  },
}

function SummaryCard({
  summary,
  modelLabel,
}: {
  summary: SummaryItem
  modelLabel: string
}) {
  const config = SUMMARY_TYPE_CONFIG[summary.summary_type]
  const Icon = config.icon
  const { t } = useI18n()
  const { formatDateTime } = useDateFormatter()

  return (
    <div
      className="glass-panel p-6 rounded-lg"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="flex items-center justify-center size-10 rounded-lg"
          style={{ backgroundColor: config.bgColor }}
        >
          <Icon className="size-5" style={{ color: config.color }} />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold" style={{ color: "var(--app-text)" }}>
            {t(config.labelKey)}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            {summary.is_active && (
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  backgroundColor: "var(--app-success-bg)",
                  color: "var(--app-success)",
                }}
              >
                {t("summary.current")}
              </span>
            )}
            <span className="text-xs" style={{ color: "var(--app-text-subtle)" }}>
              {t("summary.version", { version: summary.version })}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        className="prose prose-sm max-w-none"
        style={{ color: "var(--app-text)" }}
      >
        <div
          className="whitespace-pre-wrap leading-relaxed"
          dangerouslySetInnerHTML={{ __html: formatContent(summary.content) }}
        />
      </div>

      {/* Metadata */}
      <div
        className="flex items-center gap-4 mt-4 pt-4 text-xs"
        style={{ borderTop: "1px solid var(--app-glass-border)", color: "var(--app-text-subtle)" }}
      >
        {summary.model_used && (
          <span>{t("summary.model", { model: modelLabel })}</span>
        )}
        {summary.token_count !== null && (
          <span>{t("summary.tokens", { count: summary.token_count.toLocaleString() })}</span>
        )}
        <span>
          {t("summary.generatedAt")}{" "}
          {formatDateTime(summary.created_at, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  )
}

function formatContent(content: string): string {
  // Convert markdown-like formatting to HTML
  let formatted = content
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // Bold
    .replace(/\*(.*?)\*/g, "<em>$1</em>") // Italic
    .replace(/^- (.+)$/gm, "<li>$1</li>") // List items
    .replace(/^## (.+)$/gm, "<h3>$1</h3>") // H3
    .replace(/^# (.+)$/gm, "<h2>$1</h2>") // H2

  // Wrap consecutive list items in <ul>
  formatted = formatted.replace(/(<li>.*?<\/li>\n?)+/g, "<ul>$&</ul>")

  return formatted
}

export function SummaryView({ taskId }: SummaryViewProps) {
  const client = useAPIClient()
  const { t, locale } = useI18n()
  const [summaries, setSummaries] = useState<SummaryItem[]>([])
  const [models, setModels] = useState<LLMModel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadSummaries = async () => {
      try {
        setLoading(true)
        const result = await client.getSummary(taskId)
        setSummaries(result.items)
      } catch (err) {
        setError(err instanceof Error ? err.message : t("errors.loadSummaryFailed"))
      } finally {
        setLoading(false)
      }
    }

    loadSummaries()
  }, [client, taskId, t])

  useEffect(() => {
    let active = true
    const loadModels = async () => {
      try {
        const result = await client.getLLMModels()
        if (active) {
          setModels(result.models || [])
        }
      } catch {
        if (active) {
          setModels([])
        }
      }
    }

    loadModels()
    return () => {
      active = false
    }
  }, [client, locale])

  const modelNameMap = useMemo(() => {
    const map = new Map<string, { displayName: string; modelId?: string }>()
    models.forEach((model) => {
      map.set(model.provider, { displayName: model.display_name, modelId: model.model_id })
      if (model.model_id) {
        map.set(model.model_id, { displayName: model.display_name, modelId: model.model_id })
      }
    })
    return map
  }, [models])

  const getModelLabel = (provider: string) => {
    const modelMeta = modelNameMap.get(provider)
    if (!modelMeta) return provider
    return modelMeta.modelId
      ? `${modelMeta.displayName} / ${modelMeta.modelId}`
      : modelMeta.displayName
  }

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
          {t("summary.loading")}
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

  if (summaries.length === 0) {
    return (
      <div
        className="glass-panel p-8 rounded-lg text-center"
      >
        <Sparkles
          className="size-12 mx-auto mb-4"
          style={{ color: "var(--app-text-subtle)" }}
        />
        <p className="text-lg font-medium" style={{ color: "var(--app-text-muted)" }}>
          {t("summary.empty")}
        </p>
      </div>
    )
  }

  // Group summaries by type (only show active ones by default)
  const activeSummaries = summaries.filter((s) => s.is_active)
  const summaryTypes = Array.from(
    new Set(activeSummaries.map((s) => s.summary_type))
  )

  // If only one type, show it directly
  if (summaryTypes.length === 1) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5" style={{ color: "var(--app-primary)" }} />
          <h2 className="text-xl font-semibold" style={{ color: "var(--app-text)" }}>
            {t("summary.title")}
          </h2>
        </div>
        {activeSummaries.map((summary) => (
          <SummaryCard
            key={summary.id}
            summary={summary}
            modelLabel={summary.model_used ? getModelLabel(summary.model_used) : ""}
          />
        ))}
      </div>
    )
  }

  // Multiple types: show tabs
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-5" style={{ color: "var(--app-primary)" }} />
        <h2 className="text-xl font-semibold" style={{ color: "var(--app-text)" }}>
          {t("summary.title")}
        </h2>
      </div>

      <Tabs defaultValue={summaryTypes[0]} className="w-full">
        <TabsList>
          {summaryTypes.map((type) => {
            const config = SUMMARY_TYPE_CONFIG[type]
            const Icon = config.icon
            return (
              <TabsTrigger key={type} value={type} className="gap-2">
                <Icon className="size-4" />
                {t(config.labelKey)}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {summaryTypes.map((type) => (
          <TabsContent key={type} value={type} className="mt-4">
            <div className="space-y-4">
              {activeSummaries
                  .filter((s) => s.summary_type === type)
                  .map((summary) => (
                  <SummaryCard
                    key={summary.id}
                    summary={summary}
                    modelLabel={summary.model_used ? getModelLabel(summary.model_used) : ""}
                  />
                ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
