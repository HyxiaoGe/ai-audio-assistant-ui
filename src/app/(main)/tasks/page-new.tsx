/**
 * 任务列表页面（API 版本）
 * 使用真实的后端 API
 */

"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useTheme } from "next-themes"
import Header from "@/components/layout/Header"
import Sidebar from "@/components/layout/Sidebar"
import { TaskListAPI } from "@/components/task/TaskListAPI"
import { UploadDialog } from "@/components/upload"
import LoginModal from "@/components/auth/LoginModal"
import { useSettings } from "@/lib/settings-context"
import FullPageLoader from "@/components/common/FullPageLoader"

export default function TasksPageNew() {
  const { data: session, status } = useSession()
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const { language, setLanguage, setTheme } = useSettings()
  const { resolvedTheme } = useTheme()
  const toggleLanguage = () => {
    setLanguage(language === "zh" ? "en" : "zh")
  }

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  if (status === "loading") {
    return <FullPageLoader />
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--app-bg)" }}>
      {/* Header */}
      <Header
        isAuthenticated={!!session?.user}
        onOpenLogin={() => setLoginOpen(true)}
        language={language}
        onToggleLanguage={toggleLanguage}
        onToggleTheme={toggleTheme}
      />

      {/* 主体：Sidebar + 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto p-8">
          <TaskListAPI onRequireLogin={() => setLoginOpen(true)} />
        </main>
      </div>

      {/* 上传对话框 */}
      <UploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSuccess={(taskId) => {
          console.log("任务创建成功:", taskId)
          // 可以在这里刷新任务列表
        }}
      />
      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        callbackUrl="/tasks"
      />
    </div>
  )
}
