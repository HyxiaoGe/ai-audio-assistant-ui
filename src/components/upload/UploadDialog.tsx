/**
 * 上传对话框组件
 * 提供文件上传 + 任务选项配置
 */

"use client"

import { useState } from "react"
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { FileUploader } from "./FileUploader"
import type { TaskOptions, Language, SummaryStyle } from "@/types/api"
import { useI18n } from "@/lib/i18n-context"

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
  const { t } = useI18n()
  const [options, setOptions] = useState<TaskOptions>({
    language: "auto",
    enable_speaker_diarization: true,
    summary_style: "meeting",
  })

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
                value={options.summary_style}
                onValueChange={(value: SummaryStyle) =>
                  setOptions((prev) => ({ ...prev, summary_style: value }))
                }
              >
                <SelectTrigger id="summary-style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meeting">{t("newTask.summaryMeeting")}</SelectItem>
                  <SelectItem value="learning">{t("uploadDialog.summaryLearning")}</SelectItem>
                  <SelectItem value="interview">{t("uploadDialog.summaryInterview")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs" style={{ color: "var(--app-text-muted)" }}>
                {options.summary_style === "meeting" &&
                  t("uploadDialog.summaryMeetingDesc")}
                {options.summary_style === "learning" &&
                  t("uploadDialog.summaryLearningDesc")}
                {options.summary_style === "interview" &&
                  t("uploadDialog.summaryInterviewDesc")}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
