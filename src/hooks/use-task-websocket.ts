/**
 * WebSocket hook for real-time task progress updates
 * Connects to /api/v1/ws/tasks/{id} endpoint
 */

"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { getToken } from "@/lib/auth-token"
import type { TaskStatus } from "@/types/api"

// WebSocket message types matching backend contract
export type WebSocketMessageType = "progress" | "completed" | "error"

export interface WebSocketMessageData {
  type: WebSocketMessageType
  status: TaskStatus
  stage: string
  progress: number
  task_id: string
  request_id: string
}

export interface WebSocketErrorData {
  type: "error"
  status: "failed"
  task_id: string
  stage?: string
}

interface UseTaskWebSocketOptions {
  taskId: string
  onProgress?: (data: WebSocketMessageData) => void
  onCompleted?: (data: WebSocketMessageData) => void
  onError?: (data: WebSocketMessageData | WebSocketErrorData) => void
  enabled?: boolean
}

export function useTaskWebSocket({
  taskId,
  onProgress,
  onCompleted,
  onError,
  enabled = true,
}: UseTaskWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const reconnectAttemptsRef = useRef(0)
  const connectRef = useRef<(() => void) | null>(null)
  const authTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const isAuthenticatedRef = useRef(false)

  const MAX_RECONNECT_ATTEMPTS = 5
  const RECONNECT_DELAY = 3000
  const AUTH_TIMEOUT_MS = 5000

  // Keep ref in sync with state
  useEffect(() => {
    reconnectAttemptsRef.current = reconnectAttempts
  }, [reconnectAttempts])

  const connect = useCallback(async () => {
    if (!enabled || !taskId) return

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close()
    }

    // Get authentication token
    const token = await getToken()
    if (!token) {
      return
    }

    // Determine WebSocket URL
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const rawBaseUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://localhost:8000"
    const normalizedBaseUrl = /\/api\/v1\/?$/.test(rawBaseUrl)
      ? rawBaseUrl.replace(/\/$/, "")
      : `${rawBaseUrl.replace(/\/$/, "")}/api/v1`
    const wsBase = new URL(normalizedBaseUrl)
    const basePath =
      wsBase.pathname && wsBase.pathname !== "/"
        ? wsBase.pathname.replace(/\/$/, "")
        : ""
    const wsUrl = `${wsProtocol}//${wsBase.host}${basePath}/ws/tasks/${taskId}`

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log(`[WebSocket] Connected to task ${taskId}`)
        isAuthenticatedRef.current = false
        if (authTimeoutRef.current) {
          clearTimeout(authTimeoutRef.current)
        }
        ws.send(
          JSON.stringify({
            type: "authenticate",
            token,
          })
        )
        authTimeoutRef.current = setTimeout(() => {
          if (!isAuthenticatedRef.current) {
            console.error("[WebSocket] Authentication timeout")
            onError?.({
              type: "error",
              status: "failed",
              task_id: taskId,
              stage: "认证超时",
            })
            ws.close(4001, "Authentication timeout")
          }
        }, AUTH_TIMEOUT_MS)
      }

      ws.onmessage = (event) => {
        try {
          // Parse unified response format
          const response = JSON.parse(event.data)

          // Check for API errors (code !== 0)
          if (response.code !== 0) {
            console.error("[WebSocket] Error response:", response.message)
            // Error format: data may be WebSocketErrorData or null
            const errorData: WebSocketErrorData = response.data || {
              type: "error",
              status: "failed",
              task_id: taskId,
            }
            onError?.(errorData)
            return
          }

          // Extract actual data (code === 0)
          const data = response.data as WebSocketMessageData | { type?: string }
          console.log("[WebSocket] Message received:", data)

          if (!isAuthenticatedRef.current) {
            const isAuthAck =
              data?.type === "authenticated" ||
              response.message === "authenticated"
            if (isAuthAck) {
              isAuthenticatedRef.current = true
              if (authTimeoutRef.current) {
                clearTimeout(authTimeoutRef.current)
              }
              setIsConnected(true)
              setReconnectAttempts(0)
              return
            }
          }

          if (!isAuthenticatedRef.current) {
            isAuthenticatedRef.current = true
            if (authTimeoutRef.current) {
              clearTimeout(authTimeoutRef.current)
            }
            setIsConnected(true)
            setReconnectAttempts(0)
          }

          switch (data.type) {
            case "progress":
              onProgress?.(data as WebSocketMessageData)
              break
            case "completed":
              onCompleted?.(data as WebSocketMessageData)
              break
            case "error":
              onError?.(data as WebSocketMessageData)
              break
          }
        } catch (err) {
          console.error("[WebSocket] Failed to parse message:", err)
        }
      }

      ws.onerror = (error) => {
        console.error("[WebSocket] Error:", error)
        setIsConnected(false)
      }

      ws.onclose = (event) => {
        console.log(`[WebSocket] Disconnected (code: ${event.code})`)
        if (authTimeoutRef.current) {
          clearTimeout(authTimeoutRef.current)
        }
        isAuthenticatedRef.current = false
        setIsConnected(false)
        wsRef.current = null

        // Auto-reconnect with exponential backoff
        const currentAttempts = reconnectAttemptsRef.current
        if (enabled && currentAttempts < MAX_RECONNECT_ATTEMPTS) {
          const delay = RECONNECT_DELAY * Math.pow(2, currentAttempts)
          console.log(
            `[WebSocket] Reconnecting in ${delay}ms (attempt ${currentAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})...`
          )
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts((prev) => prev + 1)
            // Use ref to always call latest version of connect
            if (connectRef.current) {
              connectRef.current()
            }
          }, delay)
        }
      }
    } catch (err) {
      console.error("[WebSocket] Failed to create connection:", err)
      setIsConnected(false)
    }
  }, [taskId, enabled, onProgress, onCompleted, onError])

  // Keep connect ref up to date
  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (authTimeoutRef.current) {
      clearTimeout(authTimeoutRef.current)
    }
    isAuthenticatedRef.current = false
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsConnected(false)
    setReconnectAttempts(0)
  }, [])

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    connect()
    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    isConnected,
    reconnectAttempts,
    disconnect,
    reconnect: connect,
  }
}
