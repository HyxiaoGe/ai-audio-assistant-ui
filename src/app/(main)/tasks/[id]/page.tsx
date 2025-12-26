"use client";

import { useEffect, useState } from "react";
import TaskDetail from "@/components/pages/TaskDetail";

export default function TaskDetailPage() {
  const [language, setLanguage] = useState<"zh" | "en">("zh");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Load language and theme preferences
    const savedLanguage = localStorage.getItem("language") as "zh" | "en";
    const savedTheme = localStorage.getItem("theme") as "light" | "dark";
    if (savedLanguage) setLanguage(savedLanguage);
    if (savedTheme) setTheme(savedTheme);
  }, []);

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
    <TaskDetail
      language={language}
      theme={theme}
      onToggleLanguage={toggleLanguage}
      onToggleTheme={toggleTheme}
    />
  );
}
