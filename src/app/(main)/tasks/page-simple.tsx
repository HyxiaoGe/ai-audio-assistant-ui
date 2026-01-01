/**
 * 任务列表页面（简化版）
 * 假设 layout 已经处理了 Header 和 Sidebar
 */

"use client"

import { useState } from "react"
import { TaskListAPI } from "@/components/task/TaskListAPI"
import LoginModal from "@/components/auth/LoginModal"

export default function TasksPageSimple() {
  const [loginOpen, setLoginOpen] = useState(false)

  return (
    <>
      <TaskListAPI onRequireLogin={() => setLoginOpen(true)} />
      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        callbackUrl="/tasks"
      />
    </>
  )
}
