"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Dashboard from "@/components/pages/Dashboard";
import NewTaskModal, { TaskData } from "@/components/task/NewTaskModal";
import LoginModal from "@/components/auth/LoginModal";
import type { Task } from "@/data/mockTasks";

export default function DashboardPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [language, setLanguage] = useState<"zh" | "en">("zh");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Check if user is already logged in (from localStorage)
    const auth = localStorage.getItem("isAuthenticated");
    if (auth === "true") {
      setIsAuthenticated(true);
    }

    // Load language and theme preferences
    const savedLanguage = localStorage.getItem("language") as "zh" | "en";
    const savedTheme = localStorage.getItem("theme") as "light" | "dark";
    if (savedLanguage) setLanguage(savedLanguage);
    if (savedTheme) setTheme(savedTheme);
  }, []);

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("isAuthenticated");
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    localStorage.setItem("isAuthenticated", "true");
  };

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

  const handleNewTaskSubmit = (data: TaskData) => {
    const taskId = `new-${Date.now()}`;
    const title = data.type === "upload" ? data.file?.name || "新任务" : "新任务";
    const now = new Date().toISOString();

    const newTask: Task = {
      id: taskId,
      title,
      type: "audio",
      fileType: "audio",
      status: "processing",
      progress: 0,
      duration: "0分钟",
      timeAgo: "刚刚",
      transcript: [],
      keyPoints: [],
      actionItems: [],
      createdAt: now,
      updatedAt: now,
    };

    const raw = sessionStorage.getItem("mockTasks");
    const stored = raw ? (JSON.parse(raw) as Task[]) : [];
    sessionStorage.setItem("mockTasks", JSON.stringify([newTask, ...stored]));

    closeNewTaskModal();
    router.push(`/tasks/${taskId}`);
  };

  const toggleLanguage = () => {
    const newLanguage = language === "zh" ? "en" : "zh";
    setLanguage(newLanguage);
    localStorage.setItem("language", newLanguage);
  };

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  return (
    <>
      <Dashboard
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
        onOpenLogin={openLoginModal}
        onOpenNewTask={openNewTaskModal}
        language={language}
        theme={theme}
        onToggleLanguage={toggleLanguage}
        onToggleTheme={toggleTheme}
      />

      {/* 全局登录模态框 */}
      <LoginModal 
        isOpen={showLoginModal}
        onClose={closeLoginModal}
        onLogin={handleLogin}
      />

      {/* 全局新建任务模态框 */}
      <NewTaskModal 
        isOpen={showNewTaskModal}
        onClose={closeNewTaskModal}
        onSubmit={handleNewTaskSubmit}
      />
    </>
  );
}
