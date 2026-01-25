"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import Dashboard from "@/components/pages/Dashboard";
import NewTaskModal from "@/components/task/NewTaskModal";
import LoginModal from "@/components/auth/LoginModal";
import { useSettings } from "@/lib/settings-context";
import FullPageLoader from "@/components/common/FullPageLoader";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const { setTheme } = useSettings();
  const { resolvedTheme } = useTheme();
  const openLoginModal = () => {
    setShowLoginModal(true);
  };

  const closeLoginModal = () => {
    setShowLoginModal(false);
  };

  const openNewTaskModal = () => {
    setShowNewTaskModal(true);
  };

  const closeNewTaskModal = () => {
    setShowNewTaskModal(false);
  };


  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  if (status === "loading") {
    return <FullPageLoader />;
  }

  return (
    <>
      <Dashboard
        isAuthenticated={!!session?.user}
        onOpenLogin={openLoginModal}
        onOpenNewTask={openNewTaskModal}
        userName={session?.user?.name}
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
