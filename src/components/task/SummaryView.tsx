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
  Network,
  Clock,
  GitBranch,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSanitize from "rehype-sanitize"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAPIClient } from "@/lib/use-api-client"
import { useDateFormatter } from "@/lib/use-date-formatter"
import { useI18n } from "@/lib/i18n-context"
import type { LLMModel, SummaryItem, SummaryType, VisualType } from "@/types/api"
import { VisualSummaryView } from "./VisualSummaryView"

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
  // v1.3 新增可视化类型
  visual_mindmap: {
    labelKey: "summary.type.mindmap",
    icon: Network,
    color: "var(--app-warning)",
    bgColor: "var(--app-warning-bg)",
  },
  visual_timeline: {
    labelKey: "summary.type.timeline",
    icon: Clock,
    color: "var(--app-info)",
    bgColor: "var(--app-info-bg)",
  },
  visual_flowchart: {
    labelKey: "summary.type.flowchart",
    icon: GitBranch,
    color: "var(--app-danger)",
    bgColor: "var(--app-danger-bg)",
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
        className="prose prose-sm max-w-none markdown-summary"
        style={{ color: "var(--app-text)" }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
          components={{
            // Custom rendering for checkboxes
            input: ({ ...props }) => {
              if (props.type === "checkbox") {
                return (
                  <input
                    {...props}
                    className="mr-2 align-middle"
                    readOnly
                    style={{ cursor: "default" }}
                  />
                )
              }
              return <input {...props} />
            },
            // Custom table styling
            table: ({ ...props }) => (
              <div className="overflow-x-auto my-4">
                <table
                  {...props}
                  className="min-w-full border-collapse"
                  style={{
                    border: "1px solid var(--app-glass-border)",
                  }}
                />
              </div>
            ),
            th: ({ ...props }) => (
              <th
                {...props}
                className="px-4 py-2 text-left font-semibold"
                style={{
                  backgroundColor: "var(--app-glass-bg)",
                  borderBottom: "2px solid var(--app-glass-border)",
                }}
              />
            ),
            td: ({ ...props }) => (
              <td
                {...props}
                className="px-4 py-2"
                style={{
                  borderBottom: "1px solid var(--app-glass-border)",
                }}
              />
            ),
            // Enhanced list styling
            ul: ({ ...props }) => (
              <ul {...props} className="space-y-2 my-4" />
            ),
            ol: ({ ...props }) => (
              <ol {...props} className="space-y-2 my-4" />
            ),
            li: ({ children, ...props }) => {
              const content = String(children)
              // Priority markers
              const isHighPriority = content.includes("高优先级") || content.includes("紧急")
              const isLowPriority = content.includes("低优先级") || content.includes("可选")

              return (
                <li
                  {...props}
                  className="leading-relaxed"
                  style={
                    isHighPriority
                      ? { color: "var(--app-danger)" }
                      : isLowPriority
                      ? { color: "var(--app-text-subtle)" }
                      : undefined
                  }
                >
                  {children}
                </li>
              )
            },
            // Heading styles
            h1: ({ ...props }) => (
              <h1
                {...props}
                className="text-2xl font-bold mt-6 mb-4"
                style={{ color: "var(--app-text)" }}
              />
            ),
            h2: ({ ...props }) => (
              <h2
                {...props}
                className="text-xl font-semibold mt-5 mb-3"
                style={{ color: "var(--app-text)" }}
              />
            ),
            h3: ({ ...props }) => (
              <h3
                {...props}
                className="text-lg font-semibold mt-4 mb-2"
                style={{ color: "var(--app-text)" }}
              />
            ),
            // Paragraphs
            p: ({ ...props }) => (
              <p {...props} className="my-3 leading-relaxed" />
            ),
            // Code blocks
            code: ({ className, children, ...props }) => {
              // Check if it's inline code (no className means inline code)
              const isInline = !className
              if (isInline) {
                return (
                  <code
                    {...props}
                    className="px-1.5 py-0.5 rounded text-sm"
                    style={{
                      backgroundColor: "var(--app-glass-bg)",
                      color: "var(--app-primary)",
                    }}
                  >
                    {children}
                  </code>
                )
              }
              return (
                <code
                  {...props}
                  className={`block p-3 rounded text-sm overflow-x-auto ${className || ""}`}
                  style={{
                    backgroundColor: "var(--app-glass-bg)",
                  }}
                >
                  {children}
                </code>
              )
            },
            // Blockquotes
            blockquote: ({ ...props }) => (
              <blockquote
                {...props}
                className="border-l-4 pl-4 my-4 italic"
                style={{
                  borderColor: "var(--app-primary)",
                  color: "var(--app-text-muted)",
                }}
              />
            ),
          }}
        >
          {summary.content}
        </ReactMarkdown>
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

// Helper function to detect if summary is V1.2 format
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function isV12Format(content: string, createdAt?: string): boolean {
  // Method 1: Check creation date (V1.2 launched on 2026-01-16)
  if (createdAt) {
    const createdDate = new Date(createdAt)
    const v12LaunchDate = new Date("2026-01-16T00:00:00Z")
    if (createdDate >= v12LaunchDate) {
      return true
    }
  }

  // Method 2: Check for V1.2 format markers
  const v12Markers = [
    /# .*概览/,
    /## 【.*】/,
    /\|\s*类别\s*\|/,  // Table with "类别" (Category)
    /## 会议速览/,
    /## 关键信息速查/,
  ]

  return v12Markers.some(marker => marker.test(content))
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

  // 分离文本摘要和可视化摘要
  const textSummaries = activeSummaries.filter((s) => !s.summary_type.startsWith('visual_'))
  const visualSummaries = activeSummaries.filter((s) => s.summary_type.startsWith('visual_'))

  const summaryTypes = Array.from(
    new Set(textSummaries.map((s) => s.summary_type))
  )

  // If only one type, show it directly
  if (summaryTypes.length === 1 && visualSummaries.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5" style={{ color: "var(--app-primary)" }} />
          <h2 className="text-xl font-semibold" style={{ color: "var(--app-text)" }}>
            {t("summary.title")}
          </h2>
        </div>
        {textSummaries.map((summary) => (
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
          {/* 文本摘要标签 */}
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

          {/* 动态生成可视化摘要标签（只显示已生成的） */}
          {visualSummaries.map((summary) => {
            const config = SUMMARY_TYPE_CONFIG[summary.summary_type as keyof typeof SUMMARY_TYPE_CONFIG]
            if (!config) return null
            const Icon = config.icon
            return (
              <TabsTrigger key={summary.summary_type} value={summary.summary_type} className="gap-2">
                <Icon className="size-4" />
                {t(config.labelKey)}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* 文本摘要标签页 */}
        {summaryTypes.map((type) => (
          <TabsContent key={type} value={type} className="mt-4">
            <div className="space-y-4">
              {textSummaries
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

        {/* 可视化摘要标签页（动态生成，直接使用已获取的数据） */}
        {visualSummaries.map((summary) => (
          <TabsContent key={summary.summary_type} value={summary.summary_type} className="mt-4">
            <VisualSummaryView
              taskId={taskId}
              visualType={summary.summary_type.replace('visual_', '') as VisualType}
              renderMode="mermaid"
              autoLoad={false}
              initialData={summary}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
