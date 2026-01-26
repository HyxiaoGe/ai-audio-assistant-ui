/**
 * 上传对话框组件
 * 提供文件上传 + 任务选项配置
 */

"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { FileUploader } from "./FileUploader"
import type { LLMModel, SummaryStyleItem, TaskOptions, Language } from "@/types/api"
import { useI18n } from "@/lib/i18n-context"
import { useAPIClient } from "@/lib/use-api-client"

interface UploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (taskId: string) => void
}

export function UploadDialog({
  open,
  onOpenChange,
  onSuccess,
}: UploadDialogProps) {
  const { t, locale } = useI18n()
  const client = useAPIClient()
  const [options, setOptions] = useState<TaskOptions>({
    language: "auto",
    enable_speaker_diarization: false,
    summary_style: "general",
    provider: null,
    model_id: null,
  })
  const [llmModels, setLlmModels] = useState<LLMModel[]>([])
  const [summaryStyles, setSummaryStyles] = useState<SummaryStyleItem[]>([])
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    const loadData = async () => {
      // Load LLM models and summary styles in parallel
      try {
        const [modelsResult, stylesResult] = await Promise.all([
          client.getLLMModels().catch(() => ({ models: [] })),
          client.getSummaryStyles().catch(() => ({ styles: [] })),
        ])
        if (active) {
          setLlmModels(modelsResult.models || [])
          setSummaryStyles(stylesResult.styles || [])
        }
      } catch {
        if (active) {
          setLlmModels([])
          setSummaryStyles([])
        }
      }
    }
    loadData()
    return () => {
      active = false
    }
  }, [client, locale, open])

  const modelGroups = useMemo(() => {
    const groups = new Map<string, LLMModel[]>()
    llmModels.forEach((model) => {
      const key = model.display_name || model.provider
      const list = groups.get(key) || []
      list.push(model)
      groups.set(key, list)
    })
    return Array.from(groups.entries()).map(([label, models]) => ({
      label,
      models,
    }))
  }, [llmModels])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("uploadDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("uploadDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 文件上传区域 */}
          <FileUploader
            options={options}
            onSuccess={(taskId) => {
              onSuccess?.(taskId)
              onOpenChange(false)
            }}
          />

          <Separator />

          {/* 任务选项 */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium" style={{ color: "var(--app-text)" }}>
              {t("uploadDialog.optionsTitle")}
            </h3>

            {/* 摘要模型 */}
            <div className="space-y-2">
              <Label htmlFor="summary-model">{t("uploadDialog.summaryModel")}</Label>
              <Select
                value={selectedModelId || "auto"}
                onValueChange={(value) => {
                  const nextValue = value === "auto" ? null : value
                  setSelectedModelId(nextValue)
                  const selectedModel = nextValue
                    ? llmModels.find((model) =>
                        model.model_id ? model.model_id === nextValue : model.provider === nextValue
                      ) || null
                    : null
                  setOptions((prev) => ({
                    ...prev,
                    provider: selectedModel?.provider ?? null,
                    model_id: selectedModel?.model_id ?? null,
                  }))
                }}
                disabled={llmModels.length === 0}
              >
                <SelectTrigger id="summary-model">
                  <SelectValue placeholder={t("task.summaryModelAutoOption")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">{t("task.summaryModelAutoOption")}</SelectItem>
                  {modelGroups.map((group) => (
                    <SelectGroup key={group.label}>
                      <SelectLabel>{group.label}</SelectLabel>
                      {group.models.map((model) => {
                        const suffix = model.is_available
                          ? (model.is_recommended ? ` ${t("task.summaryModelRecommended")}` : "")
                          : ` ${t("task.summaryModelUnavailable")}`
                        const label = model.model_id ? `  ${model.model_id}` : `  ${model.provider}`
                        return (
                          <SelectItem
                            key={model.model_id || model.provider}
                            value={model.model_id || model.provider}
                            disabled={!model.is_available}
                            className="pl-5"
                          >
                            {label}{suffix}
                          </SelectItem>
                        )
                      })}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 语言选择 */}
            <div className="space-y-2">
              <Label htmlFor="language">{t("uploadDialog.languageLabel")}</Label>
              <Select
                value={options.language}
                onValueChange={(value: Language) =>
                  setOptions((prev) => ({ ...prev, language: value }))
                }
              >
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">{t("task.languageAuto")}</SelectItem>
                  <SelectItem value="zh">{t("task.languageZh")}</SelectItem>
                  <SelectItem value="en">{t("task.languageEn")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 说话人分离 */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="speaker-diarization">{t("uploadDialog.speakerDiarization")}</Label>
                <p className="text-xs" style={{ color: "var(--app-text-muted)" }}>
                  {t("uploadDialog.speakerDiarizationDesc")}
                </p>
              </div>
              <Switch
                id="speaker-diarization"
                checked={options.enable_speaker_diarization}
                onCheckedChange={(checked) =>
                  setOptions((prev) => ({
                    ...prev,
                    enable_speaker_diarization: checked,
                  }))
                }
              />
            </div>

            {/* 摘要风格 */}
            <div className="space-y-2">
              <Label htmlFor="summary-style">{t("uploadDialog.summaryStyle")}</Label>
              <Select
                value={options.summary_style || "general"}
                onValueChange={(value: string) =>
                  setOptions((prev) => ({ ...prev, summary_style: value }))
                }
                disabled={summaryStyles.length === 0}
              >
                <SelectTrigger id="summary-style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {summaryStyles.length > 0 ? (
                    summaryStyles.map((style) => (
                      <SelectItem key={style.id} value={style.id}>
                        {style.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="general">{t("newTask.summaryGeneral")}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {summaryStyles.length > 0 && (
                <p className="text-xs" style={{ color: "var(--app-text-muted)" }}>
                  {summaryStyles.find((s) => s.id === options.summary_style)?.focus}
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
