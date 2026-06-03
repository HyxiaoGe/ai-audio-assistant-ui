// 全局 WS 消息分流的不变量，从 use-global-websocket 抽出为纯函数便于单测：
// 按统一信封的 kind 分流；notification 走增量插入 + 单条 toast（不再全量重取，
// 这是「角标不更新/刷新才更新」竞态的根因）；task_progress 维持任务 map 更新。

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
  updateTask: (taskId: string, data: WsTaskProgressData) => void
  loadNotifications: () => void
  refreshUnread: () => void
  showNotificationToast: (data: WsNotificationData) => void
}

export function routeWebSocketMessage(
  envelope: WsEnvelope,
  deps: WsRouterDeps
): void {
  switch (envelope.kind) {
    case "notification": {
      const data = envelope.data as WsNotificationData
      deps.addNotificationFromWebSocket(data)
      deps.showNotificationToast(data)
      return
    }
    case "task_progress": {
      const data = envelope.data as WsTaskProgressData
      if (!data || !data.task_id) {
        return
      }
      deps.updateTask(data.task_id, data)
      return
    }
    default:
      return
  }
}
