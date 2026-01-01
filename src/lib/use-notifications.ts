"use client"

import { useMemo, useSyncExternalStore } from "react"
import {
  clearNotifications,
  getNotificationsState,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications,
} from "@/lib/notifications-store"

export function useNotifications() {
  const state = useSyncExternalStore(
    subscribeNotifications,
    getNotificationsState,
    getNotificationsState
  )

  const unreadCount = useMemo(
    () => state.notifications.filter((item) => !item.read).length,
    [state.notifications]
  )

  return {
    notifications: state.notifications,
    unreadCount,
    markRead: markNotificationRead,
    markAllRead: markAllNotificationsRead,
    clearAll: clearNotifications,
  }
}
