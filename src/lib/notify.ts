"use client"

import { toast } from "sonner"
import { pushNotification, type NotificationType } from "@/lib/notifications-store"

function notify(
  type: NotificationType,
  message: string,
  options?: { persist?: boolean }
) {
  if (options?.persist !== false) {
    pushNotification({ type, message })
  }
  if (type === "success") {
    toast.success(message)
    return
  }
  if (type === "error") {
    toast.error(message)
    return
  }
  toast(message)
}

export const notifySuccess = (
  message: string,
  options?: { persist?: boolean }
) => notify("success", message, options)
export const notifyError = (
  message: string,
  options?: { persist?: boolean }
) => notify("error", message, options)
export const notifyInfo = (
  message: string,
  options?: { persist?: boolean }
) => notify("info", message, options)
