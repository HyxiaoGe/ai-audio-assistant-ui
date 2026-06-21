"use client"

import { useEffect } from "react"

import { installGlobalErrorListeners } from "@/lib/client-error-report"

/**
 * 注册全局未捕获错误监听(window 'error' / 'unhandledrejection'），把 React 错误边界之外的
 * 错误(异步回调、事件处理器、未 await 的 Promise）上报到后端 log-only sink。渲染 null，
 * 不影响布局；卸载时自动移除监听。
 */
export function GlobalErrorListener() {
  useEffect(() => installGlobalErrorListeners(), [])
  return null
}
