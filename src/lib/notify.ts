"use client"

import { toast, type ExternalToast } from "sonner"

// 历史调用点（如 Settings）仍传 { persist: false }；新封装不再写任何 store，
// persist 选项被剥离后丢弃，其余字段透传给 sonner。
type NotifyOptions = ExternalToast & { persist?: boolean }

function toSonnerOptions(options?: NotifyOptions): ExternalToast | undefined {
  if (!options) return undefined
  const { persist: _persist, ...rest } = options
  return Object.keys(rest).length > 0 ? rest : undefined
}

export const notifySuccess = (message: string, options?: NotifyOptions) =>
  toast.success(message, toSonnerOptions(options))

export const notifyError = (message: string, options?: NotifyOptions) =>
  toast.error(message, toSonnerOptions(options))

export const notifyInfo = (message: string, options?: NotifyOptions) =>
  toast.info(message, toSonnerOptions(options))

export const notifyWarning = (message: string, options?: NotifyOptions) =>
  toast.warning(message, toSonnerOptions(options))
