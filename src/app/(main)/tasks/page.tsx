"use client";

import { useCallback, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useTheme } from "next-themes";
import TaskList from "@/components/pages/TaskList";
import LoginModal from "@/components/auth/LoginModal";
import NewTaskModal from "@/components/task/NewTaskModal";
import { useSettingsActions } from "@/lib/settings-context";
import FullPageLoader from "@/components/common/FullPageLoader";

export default function TaskListPage() {
  const authUser = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const { setTheme } = useSettingsActions();
  const { resolvedTheme } = useTheme();
  // 用 useCallback 稳定 handler 身份，避免重渲染（如开关弹窗）把新函数传给
  // TaskList，连带触发其列表/状态计数拉取 effect 重跑等无谓请求。
  const openLoginModal = useCallback(() => setShowLoginModal(true), []);
  const closeLoginModal = useCallback(() => setShowLoginModal(false), []);
  const openNewTaskModal = useCallback(() => setShowNewTaskModal(true), []);
  const closeNewTaskModal = useCallback(() => setShowNewTaskModal(false), []);
  const toggleTheme = useCallback(
    () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
    [resolvedTheme, setTheme],
  );

  if (status === "loading") {
    return <FullPageLoader />;
  }

  return (
    <>
      <TaskList
        isAuthenticated={!!authUser}
        onOpenLogin={openLoginModal}
        onOpenNewTask={openNewTaskModal}
        onToggleTheme={toggleTheme}
      />

      {/* 全局登录模态框 */}
      <LoginModal 
        isOpen={showLoginModal}
        onClose={closeLoginModal}
        callbackUrl="/tasks"
      />

      {/* 全局新建任务模态框 */}
      <NewTaskModal
        isOpen={showNewTaskModal}
        onClose={closeNewTaskModal}
      />
    </>
  );
}
