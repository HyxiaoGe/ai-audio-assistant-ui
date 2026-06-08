"use client";

import { useSettingsActions } from "@/lib/settings-context";
import { useTheme } from "next-themes";
import TaskDetail from "@/components/pages/TaskDetail";

export default function TaskDetailPage() {
  const { setTheme } = useSettingsActions();
  const { resolvedTheme } = useTheme();


  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <TaskDetail
      onToggleTheme={toggleTheme}
    />
  );
}
