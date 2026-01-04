"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import TaskList from "@/components/pages/TaskList";
import LoginModal from "@/components/auth/LoginModal";
import NewTaskModal from "@/components/task/NewTaskModal";
import { useSettings } from "@/lib/settings-context";
import FullPageLoader from "@/components/common/FullPageLoader";

export default function TaskListPage() {
  const { data: session, status } = useSession();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const { language, setLanguage, setTheme } = useSettings();
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

  const toggleLanguage = () => {
    setLanguage(language === "zh" ? "en" : "zh");
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  if (status === "loading") {
    return <FullPageLoader />;
  }

  return (
    <>
      <TaskList
        isAuthenticated={!!session?.user}
        onOpenLogin={openLoginModal}
        onOpenNewTask={openNewTaskModal}
        language={language}
        onToggleLanguage={toggleLanguage}
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
