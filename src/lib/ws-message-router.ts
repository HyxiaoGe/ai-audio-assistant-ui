// 全局 WS 消息分流的不变量，从 use-global-websocket 抽出为纯函数便于单测：
// 按统一信封的 kind 分流；notification 走增量插入 + 单条 toast（不再全量重取，
// 这是「角标不更新/刷新才更新」竞态的根因）；task_progress 维持任务 map 更新。

import type { WsImageReadyData } from "@/types/api"
import type { TaskProgress } from "@/store/global-store"

export interface WsNotificationData {
  id: string
  type: string
  category: string
  priority: string
  params: Record<string, unknown>
  action_url: string | null
  title?: string | null
  message?: string | null
  created_at: string
  read_at: string | null
}

export interface WsTaskProgressData {
  task_id: string
  status?: string
  stage?: string
  progress?: number
  task_title?: string
}

export interface WsEnvelope {
  kind?: string
  data?: unknown
  traceId?: string
}

export interface WsRouterDeps {
  addNotificationFromWebSocket: (data: WsNotificationData) => void
  // 领域口径（与 store 的 updateTask 对齐）：router 在下面把 wire 字段 task_title 翻译成 title 后再传入。
  updateTask: (taskId: string, data: Partial<TaskProgress>) => void
  loadNotifications: () => void
  refreshUnread: () => void
  showNotificationToast: (data: WsNotificationData) => void
  applyImageReady: (data: WsImageReadyData) => void
}

export function routeWebSocketMessage(
  envelope: WsEnvelope,
  deps: WsRouterDeps
): void {
  switch (envelope.kind) {
    case "notification": {
      const data = envelope.data as WsNotificationData
      // 与 task_progress 对称的坏消息守卫：缺 payload/id 不抛、不动 store/toast。
      if (!data || !data.id) {
        return
      }
      deps.addNotificationFromWebSocket(data)
      deps.showNotificationToast(data)
      return
    }
    case "task_progress": {
      const data = envelope.data as WsTaskProgressData
      if (!data || !data.task_id) {
        return
      }
      // wire→domain：WS 用 task_title、store/领域用 title。此处是唯一翻译点——不映射则
      // TaskProgress.title 永远 undefined，标题只能等 completed 全量重拉才刷新（用户报告的根因）。
      // 无 task_title 时不写 title 键，避免用 undefined 覆盖已有标题。
      const { task_title, ...rest } = data
      deps.updateTask(data.task_id, {
        ...(rest as Partial<TaskProgress>),
        ...(task_title !== undefined ? { title: task_title } : {}),
      })
      return
    }
    case "image_ready": {
      // ⚠️ image_ready 是【扁平】信封：task_id/placeholder/status/url/... 与 kind 同级、无 data 包裹，
      // 与后端 publish_image_ready_global（image_generator.py）逐字对齐——不同于 notification/task_progress
      // 的嵌套 data。故这里从 envelope 顶层取字段，而非 envelope.data。
      const data = envelope as unknown as WsImageReadyData
      // 坏消息守卫：缺 task_id / placeholder 不抛、不动 store。
      if (!data || !data.task_id || !data.placeholder) {
        return
      }
      deps.applyImageReady(data)
      return
    }
    default:
      return
  }
}
