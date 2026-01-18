"use client"

import React, { useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { VisualType, ContentStyle } from "@/types/api"
import { useAPIClient } from "@/lib/use-api-client"

interface VisualSummaryGeneratorProps {
  taskId: string
  onGenerated?: (visualType: VisualType) => void
}

export function VisualSummaryGenerator({
  taskId,
  onGenerated,
}: VisualSummaryGeneratorProps) {
  const [visualType, setVisualType] = useState<VisualType>("mindmap")
  const [contentStyle, setContentStyle] = useState<ContentStyle | "auto">("auto")
  const [generateImage, setGenerateImage] = useState(false)
  const [imageFormat, setImageFormat] = useState<"png" | "svg">("png")
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const client = useAPIClient()

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    setProgress(0)

    try {
      // 1. 发起生成请求
      const response = await client.generateVisualSummary(taskId, {
        visual_type: visualType,
        content_style: contentStyle === "auto" ? null : contentStyle,
        generate_image: generateImage,
        image_format: imageFormat,
      })

      if (response.code !== 0) {
        throw new Error(response.message)
      }

      // 2. 订阅 SSE 进度更新
      const unsubscribe = client.subscribeVisualSummaryProgress(
        taskId,
        visualType,
        (event) => {
          switch (event.type) {
            case "visual.generating":
              setProgress(30)
              break
            case "visual.rendering":
              setProgress(60)
              break
            case "visual.uploading":
              setProgress(80)
              break
            case "visual.completed":
              setProgress(100)
              setLoading(false)
              onGenerated?.(visualType)
              unsubscribe()
              break
            case "error":
              setError(event.data?.error || "生成失败")
              setLoading(false)
              unsubscribe()
              break
          }
        },
        (err) => {
          setError(err.message)
          setLoading(false)
        }
      )

      // 超时保护（30秒）
      setTimeout(() => {
        if (loading) {
          unsubscribe()
          setLoading(false)
          setError("生成超时，请稍后查看")
        }
      }, 30000)
    } catch (err) {
      const message = err instanceof Error ? err.message : "生成失败"
      setError(message)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 border rounded-lg p-6 bg-card">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">生成可视化摘要</h3>
      </div>

      {/* 可视化类型选择 */}
      <div className="space-y-2">
        <Label>可视化类型</Label>
        <Select value={visualType} onValueChange={(v) => setVisualType(v as VisualType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mindmap">思维导图（适合讲座/播客）</SelectItem>
            <SelectItem value="timeline">时间轴（适合会议/讲座）</SelectItem>
            <SelectItem value="flowchart">流程图（适合会议/教程）</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 内容风格选择 */}
      <div className="space-y-2">
        <Label>内容风格</Label>
        <Select value={contentStyle} onValueChange={(v) => setContentStyle(v as ContentStyle | "auto")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">自动检测</SelectItem>
            <SelectItem value="meeting">会议</SelectItem>
            <SelectItem value="lecture">讲座</SelectItem>
            <SelectItem value="podcast">播客</SelectItem>
            <SelectItem value="video">视频</SelectItem>
            <SelectItem value="general">通用</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 图片生成选项 */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>生成图片</Label>
          <p className="text-sm text-muted-foreground">
            是否在后端渲染 PNG/SVG 图片
          </p>
        </div>
        <Switch checked={generateImage} onCheckedChange={setGenerateImage} />
      </div>

      {/* 图片格式选择 */}
      {generateImage && (
        <div className="space-y-2">
          <Label>图片格式</Label>
          <Select value={imageFormat} onValueChange={(v) => setImageFormat(v as "png" | "svg")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="png">PNG（适合分享）</SelectItem>
              <SelectItem value="svg">SVG（矢量，文件小）</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 生成按钮 */}
      <Button
        className="w-full"
        onClick={handleGenerate}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            生成中... {progress}%
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            生成可视化摘要
          </>
        )}
      </Button>
    </div>
  )
}
