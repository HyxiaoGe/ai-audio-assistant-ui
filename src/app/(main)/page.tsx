"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { useTheme } from "next-themes";
import Dashboard from "@/components/pages/Dashboard";
import NewTaskModal from "@/components/task/NewTaskModal";
import LoginModal from "@/components/auth/LoginModal";
import { useSettingsActions } from "@/lib/settings-context";
import FullPageLoader from "@/components/common/FullPageLoader";

export default function DashboardPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const { setTheme } = useSettingsActions();
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

  // 未登录且登录态【已解析】→ 重定向到探索广场（/ 不再独立承载探索，去掉「概览/探索」内容雷同）。
  // 严格 gate 在 status !== "loading"：登录态仍在解析（hydration / SSO 静默探测）时绝不重定向，
  // 否则会把已登录用户在解析瞬间误弹去 /explore。登录入口转由 /explore 的 Header 承担。
  const shouldRedirect = status !== "loading" && !authUser;
  useEffect(() => {
    if (shouldRedirect) {
      router.replace("/explore");
    }
  }, [shouldRedirect, router]);

  if (status === "loading") {
    return <FullPageLoader />;
  }

  // 未登录：不再停留在 /，渲染轻量 loader 等待上面的 effect 重定向到 /explore（避免闪一下 Explore 又跳）。
  if (!authUser) {
    return <FullPageLoader />;
  }

  return (
    <>
      <Dashboard
        isAuthenticated
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
