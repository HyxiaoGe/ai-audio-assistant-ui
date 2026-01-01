/**
 * 文件上传组件使用示例
 */

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FileUploader, UploadDialog } from "@/components/upload"

// ============================================================================
// 示例 1: 基础使用 - 直接使用 FileUploader
// ============================================================================

export function BasicUploadExample() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">上传文件</h2>
      <FileUploader
        onSuccess={(taskId) => {
          console.log("上传成功，任务 ID:", taskId)
        }}
        onError={(error) => {
          console.error("上传失败:", error)
        }}
      />
    </div>
  )
}

// ============================================================================
// 示例 2: 使用对话框 - UploadDialog
// ============================================================================

export function DialogUploadExample() {
  const [open, setOpen] = useState(false)

  return (
    <div className="p-6">
      <Button onClick={() => setOpen(true)}>打开上传对话框</Button>

      <UploadDialog
        open={open}
        onOpenChange={setOpen}
        onSuccess={(taskId) => {
          console.log("上传成功，任务 ID:", taskId)
          // 对话框会自动关闭并跳转到任务详情页
        }}
      />
    </div>
  )
}

// ============================================================================
// 示例 3: 自定义选项
// ============================================================================

export function CustomOptionsExample() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">上传文件（自定义选项）</h2>
      <FileUploader
        options={{
          language: "zh",
          enable_speaker_diarization: false,
          summary_style: "learning",
        }}
        onSuccess={(taskId) => {
          console.log("上传成功，任务 ID:", taskId)
          // 默认会自动跳转到任务详情页
        }}
      />
    </div>
  )
}

// ============================================================================
// 示例 4: 在现有页面中集成
// ============================================================================

export function IntegratedExample() {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">我的任务</h1>
        <Button onClick={() => setUploadDialogOpen(true)}>
          + 上传文件
        </Button>
      </div>

      <div className="grid gap-4">
        {/* 这里是任务列表 */}
        <p className="text-muted-foreground">暂无任务</p>
      </div>

      {/* 上传对话框 */}
      <UploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSuccess={(taskId) => {
          console.log("新任务已创建:", taskId)
          // 刷新任务列表
        }}
      />
    </div>
  )
}
