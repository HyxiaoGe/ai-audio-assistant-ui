"use client";

import { useCallback, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useTheme } from "next-themes";
import Dashboard from "@/components/pages/Dashboard";
import NewTaskModal from "@/components/task/NewTaskModal";
import LoginModal from "@/components/auth/LoginModal";
import { useSettings } from "@/lib/settings-context";
import FullPageLoader from "@/components/common/FullPageLoader";

export default function DashboardPage() {
  const authUser = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const { setTheme } = useSettings();
  const { resolvedTheme } = useTheme();
  // 用 useCallback 稳定这些 handler 的身份，避免每次重渲染（如开关弹窗）把新函数
  // 传给子组件，连带触发 Dashboard 拉取 effect 重跑等无谓副作用。
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
      <Dashboard
        isAuthenticated={!!authUser}
        onOpenLogin={openLoginModal}
        onOpenNewTask={openNewTaskModal}
        userName={authUser?.name}
        onToggleTheme={toggleTheme}
      />

      {/* 全局登录模态框 */}
      <LoginModal 
        isOpen={showLoginModal}
        onClose={closeLoginModal}
        callbackUrl="/"
      />

      {/* 全局新建任务模态框 */}
      <NewTaskModal 
        isOpen={showNewTaskModal}
        onClose={closeNewTaskModal}
      />
    </>
  );
}
