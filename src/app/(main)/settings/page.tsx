"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Settings from "@/components/pages/Settings";
import LoginModal from "@/components/auth/LoginModal";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
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

  useEffect(() => {
    if (session?.user) {
      setIsAuthenticated(true);
      localStorage.setItem("isAuthenticated", "true");
    }
  }, [session]);

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
      <Settings
        isAuthenticated={isAuthenticated}
        onOpenLogin={openLoginModal}
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
    </>
  );
}
