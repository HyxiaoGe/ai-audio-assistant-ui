import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { TaskStatus } from "@/types"

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
  pending: { label: "待处理", className: "bg-gray-100 text-gray-600" },
  processing: { label: "处理中", className: "bg-blue-100 text-blue-600" },
  completed: { label: "已完成", className: "bg-green-100 text-green-600" },
  failed: { label: "失败", className: "bg-red-100 text-red-600" },
}

interface StatusBadgeProps {
  status: TaskStatus
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = statusConfig[status]
  return (
    <Badge variant="secondary" className={cn("font-normal", config.className)}>
      {config.label}
    </Badge>
  )
}
