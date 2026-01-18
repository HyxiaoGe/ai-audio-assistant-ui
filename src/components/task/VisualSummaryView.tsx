"use client"

import React, { useEffect, useState, useRef } from "react"
import mermaid from "mermaid"
import { Loader2, Download, Maximize2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { VisualSummaryResponse, VisualType, SummaryItem } from "@/types/api"
import { useAPIClient } from "@/lib/use-api-client"

interface VisualSummaryViewProps {
  taskId: string
  visualType: VisualType
  autoLoad?: boolean  // 是否自动加载
  renderMode?: "mermaid" | "image" | "both"  // 渲染模式
  className?: string
  initialData?: SummaryItem  // 直接传入已获取的数据（从 getSummary 接口）
}

export function VisualSummaryView({
  taskId,
  visualType,
  autoLoad = true,
  renderMode = "mermaid",
  className = "",
  initialData,
}: VisualSummaryViewProps) {
  const [data, setData] = useState<VisualSummaryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mermaidRendered, setMermaidRendered] = useState(false)
  const mermaidRef = useRef<HTMLDivElement>(null)
  const client = useAPIClient()

  // 初始化 Mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
    })
  }, [])

  // 加载可视化摘要数据
  const loadVisualSummary = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await client.getVisualSummary(taskId, visualType)

      if (response.code !== 0) {
        throw new Error(response.message)
      }

      setData(response.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : "加载失败"
      setError(message)
      console.error("Failed to load visual summary:", err)
    } finally {
      setLoading(false)
    }
  }

  // 渲染 Mermaid 图表
  const renderMermaid = async () => {
    if (!data?.content || !mermaidRef.current) return

    try {
      const { svg } = await mermaid.render(
        `mermaid-${data.id}`,
        data.content
      )

      if (mermaidRef.current) {
        mermaidRef.current.innerHTML = svg
        setMermaidRendered(true)
      }
    } catch (err) {
      console.error("Mermaid render error:", err)
      setError("图表渲染失败，可能是 Mermaid 语法错误")
    }
  }

  // 处理 initialData（从父组件传入的已获取数据）
  useEffect(() => {
    if (initialData && initialData.content) {
      // 将 SummaryItem 转换为 VisualSummaryResponse 格式
      const convertedData: VisualSummaryResponse = {
        id: initialData.id,
        task_id: taskId,
        visual_type: visualType,
        format: initialData.visual_format || "mermaid",
        content: initialData.content,
        image_url: initialData.image_url || null,
        model_used: initialData.model_used || null,
        token_count: initialData.token_count || null,
        created_at: initialData.created_at,
      }
      setData(convertedData)
    }
  }, [initialData, taskId, visualType])

  // 自动加载（仅在没有 initialData 时）
  useEffect(() => {
    if (autoLoad && !initialData) {
      loadVisualSummary()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, visualType, autoLoad, initialData])

  // 数据加载后渲染 Mermaid
  useEffect(() => {
    if (data && (renderMode === "mermaid" || renderMode === "both")) {
      renderMermaid()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, renderMode])

  // 下载图片
  const handleDownloadImage = () => {
    if (!data?.image_url) return

    const link = document.createElement("a")
    link.href = client.getVisualImageUrl(data.image_url)
    link.download = `${visualType}_${taskId}.${data.image_url.split(".").pop()}`
    link.click()
  }

  // 全屏查看
  const handleFullscreen = () => {
    if (!mermaidRef.current) return

    if (mermaidRef.current.requestFullscreen) {
      mermaidRef.current.requestFullscreen()
    }
  }

  // 加载状态
  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">正在加载可视化摘要...</span>
      </div>
    )
  }

  // 错误状态
  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button
            variant="outline"
            size="sm"
            className="ml-4"
            onClick={loadVisualSummary}
          >
            重试
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  // 无数据
  if (!data) {
    return (
      <div className={`text-center py-12 text-muted-foreground ${className}`}>
        <p>暂无可视化摘要</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={loadVisualSummary}
        >
          加载
        </Button>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 工具栏 */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>模型: {data.model_used || "未知"}</span>
          <span>•</span>
          <span>格式: {data.format}</span>
          {data.image_url && (
            <>
              <span>•</span>
              <span>已生成图片</span>
            </>
          )}
        </div>

        <div className="flex gap-2">
          {data.image_url && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadImage}
            >
              <Download className="h-4 w-4 mr-2" />
              下载图片
            </Button>
          )}

          {renderMode === "mermaid" && mermaidRendered && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleFullscreen}
            >
              <Maximize2 className="h-4 w-4 mr-2" />
              全屏
            </Button>
          )}
        </div>
      </div>

      {/* 图表内容 */}
      {renderMode === "image" && data.image_url ? (
        // 仅显示后端生成的图片
        <div className="flex justify-center bg-muted/30 rounded-lg p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={client.getVisualImageUrl(data.image_url)}
            alt={`${visualType} visual summary`}
            className="max-w-full h-auto"
          />
        </div>
      ) : renderMode === "mermaid" ? (
        // 仅使用 Mermaid.js 渲染
        <div
          ref={mermaidRef}
          className="mermaid-container flex justify-center bg-muted/30 rounded-lg p-6 overflow-auto"
          style={{ minHeight: "400px" }}
        />
      ) : (
        // 同时显示两者（both 模式）
        <div className="space-y-4">
          {data.image_url && (
            <div>
              <h4 className="text-sm font-medium mb-2">后端渲染图片</h4>
              <div className="flex justify-center bg-muted/30 rounded-lg p-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={client.getVisualImageUrl(data.image_url)}
                  alt={`${visualType} visual summary (backend)`}
                  className="max-w-full h-auto"
                />
              </div>
            </div>
          )}

          <div>
            <h4 className="text-sm font-medium mb-2">客户端渲染（Mermaid.js）</h4>
            <div
              ref={mermaidRef}
              className="mermaid-container flex justify-center bg-muted/30 rounded-lg p-6 overflow-auto"
              style={{ minHeight: "400px" }}
            />
          </div>
        </div>
      )}

      {/* 原始代码（可折叠查看）*/}
      <details className="border rounded-lg p-4">
        <summary className="cursor-pointer text-sm font-medium">
          查看 Mermaid 源代码
        </summary>
        <pre className="mt-3 p-4 bg-muted rounded text-xs overflow-x-auto">
          <code>{data.content}</code>
        </pre>
      </details>
    </div>
  )
}

// 导出便捷的预设组件
export function MindmapView({ taskId, ...props }: Omit<VisualSummaryViewProps, "visualType">) {
  return <VisualSummaryView taskId={taskId} visualType="mindmap" {...props} />
}

export function TimelineView({ taskId, ...props }: Omit<VisualSummaryViewProps, "visualType">) {
  return <VisualSummaryView taskId={taskId} visualType="timeline" {...props} />
}

export function FlowchartView({ taskId, ...props }: Omit<VisualSummaryViewProps, "visualType">) {
  return <VisualSummaryView taskId={taskId} visualType="flowchart" {...props} />
}
