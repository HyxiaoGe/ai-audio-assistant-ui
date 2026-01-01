"use client"

export type NotificationType = "success" | "error" | "info"

export interface NotificationItem {
  id: string
  type: NotificationType
  message: string
  createdAt: string
  read: boolean
}

interface NotificationsState {
  notifications: NotificationItem[]
}

type Listener = () => void

let state: NotificationsState = {
  notifications: [],
}

const listeners = new Set<Listener>()

function emit() {
  listeners.forEach((listener) => listener())
}

function update(next: NotificationsState) {
  state = next
  emit()
}

export function getNotificationsState(): NotificationsState {
  return state
}

export function subscribeNotifications(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function pushNotification(input: {
  type: NotificationType
  message: string
}) {
  const nextItem: NotificationItem = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: input.type,
    message: input.message,
    createdAt: new Date().toISOString(),
    read: false,
  }
  update({
    notifications: [nextItem, ...state.notifications].slice(0, 50),
  })
}

export function markNotificationRead(id: string) {
  update({
    notifications: state.notifications.map((item) =>
      item.id === id ? { ...item, read: true } : item
    ),
  })
}

export function markAllNotificationsRead() {
  update({
    notifications: state.notifications.map((item) => ({ ...item, read: true })),
  })
}

export function clearNotifications() {
  update({ notifications: [] })
}
