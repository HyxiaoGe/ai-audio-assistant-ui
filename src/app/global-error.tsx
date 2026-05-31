"use client"

import { useEffect } from "react"

/**
 * 全局错误边界：仅当 root layout 本身渲染抛错时触发，会替换整个根布局（含 html/body）。
 * 此时位于所有 Provider 之外，且不会加载 globals.css —— 故不可用 useI18n/主题/Tailwind，
 * 文案双语硬编码、样式全部内联，作为最后兜底的“白屏”替代。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          color: "#0f172a",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "420px", width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: "44px", marginBottom: "16px" }} aria-hidden="true">
            ⚠️
          </div>
          <h1 style={{ fontSize: "20px", fontWeight: 600, margin: "0 0 8px" }}>
            出错了 / Something went wrong
          </h1>
          <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 24px" }}>
            应用遇到了意外错误，请重试。
            <br />
            The app hit an unexpected error. Please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              height: "40px",
              padding: "0 24px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              background: "#0f172a",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 500,
            }}
          >
            重试 / Retry
          </button>
        </div>
      </body>
    </html>
  )
}
