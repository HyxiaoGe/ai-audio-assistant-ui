/**
 * 状态筛选组件
 * 用于任务列表的状态过滤
 */

"use client"

import type { TaskStatus } from "@/types/api"
import { useI18n } from "@/lib/i18n-context"

interface StatusFilterProps {
  /** 当前选中的状态 */
  value: "all" | TaskStatus
  /** 状态变化回调 */
  onChange: (status: "all" | TaskStatus) => void
  /** 各状态的任务数量 */
  counts: {
    all: number
    pending: number
    extracting: number
    transcribing: number
    summarizing: number
    completed: number
    failed: number
  }
}

// 简化的状态分组（用于显示）
const SIMPLIFIED_STATUSES: Array<"all" | "processing" | "completed" | "failed"> = [
  "all",
  "processing",
  "completed",
  "failed",
]

export function StatusFilter({ value, onChange, counts }: StatusFilterProps) {
  const { t } = useI18n()
  // 计算处理中的任务总数
  const processingCount =
    counts.pending +
    counts.extracting +
    counts.transcribing +
    counts.summarizing

  const simplifiedCounts = {
    all: counts.all,
    processing: processingCount,
    completed: counts.completed,
    failed: counts.failed,
  }

  const handleClick = (status: "all" | "processing" | "completed" | "failed") => {
    if (status === "processing") {
      // 处理中状态映射到具体的处理阶段
      onChange("pending") // 或者可以显示所有处理中的状态
    } else if (status === "all") {
      onChange("all")
    } else {
      onChange(status as TaskStatus)
    }
  }

  const isActive = (status: "all" | "processing" | "completed" | "failed") => {
    if (status === "processing") {
      return (
        value === "pending" ||
        value === "extracting" ||
        value === "transcribing" ||
        value === "summarizing"
      )
    }
    return value === status
  }

  return (
    <div className="flex items-center gap-3">
      {SIMPLIFIED_STATUSES.map((status) => {
        const active = isActive(status)
        const count = simplifiedCounts[status]
        const label =
          status === "all"
            ? t("tasks.filterAll")
            : status === "processing"
              ? t("tasks.filterProcessing")
              : status === "completed"
                ? t("tasks.filterCompleted")
                : t("tasks.filterFailed")

        return (
          <button
            key={status}
            onClick={() => handleClick(status)}
            className="glass-chip px-4 py-2 rounded-lg text-sm"
            data-active={active}
          >
            {label} ({count})
          </button>
        )
      })}
    </div>
  )
}
