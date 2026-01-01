"use client";

import { useSettings } from "@/lib/settings-context";
import { useTheme } from "next-themes";
import TaskDetail from "@/components/pages/TaskDetail";

export default function TaskDetailPage() {
  const { language, setLanguage, setTheme } = useSettings();
  const { resolvedTheme } = useTheme();

  const toggleLanguage = () => {
    setLanguage(language === "zh" ? "en" : "zh");
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <TaskDetail
      language={language}
      onToggleLanguage={toggleLanguage}
      onToggleTheme={toggleTheme}
    />
  );
}
