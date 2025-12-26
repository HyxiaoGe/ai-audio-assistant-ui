import { Progress } from "@/components/ui/progress"
import { formatDuration, formatRelativeTime } from "@/lib/utils"
import type { Task } from "@/types"

interface TaskDetailProcessingProps {
  task: Task
}

const getStageLabel = (progress: number) => {
  if (progress < 33) return "上传完成"
  if (progress < 66) return "音频转写中"
  if (progress < 100) return "AI 摘要生成中"
  return "处理完成"
}

const formatFileSize = (bytes?: number) => {
  if (!bytes) return "未知大小"
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const TaskDetailProcessing = ({ task }: TaskDetailProcessingProps) => {
  const progress = task.progress ?? 0

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-white p-4">
        <h1 className="text-xl font-semibold text-gray-900">{task.title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {formatDuration(task.duration)} · {formatRelativeTime(task.createdAt)}
        </p>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">当前进度</p>
            <p className="text-lg font-semibold text-gray-900">{getStageLabel(progress)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">文件大小</p>
            <p className="text-sm font-medium text-gray-900">{formatFileSize(task.fileSize)}</p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <Progress value={progress} />
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{progress}%</span>
            <span>预计剩余约 5 分钟</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-blue-50 p-4 text-sm text-blue-700">
        处理期间可以关闭页面，进度会自动保存。处理完成后可在任务列表查看结果。
      </div>
    </div>
  )
}
