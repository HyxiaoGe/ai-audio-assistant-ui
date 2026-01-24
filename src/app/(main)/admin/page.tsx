"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import Admin from "@/components/pages/Admin";
import LoginModal from "@/components/auth/LoginModal";
import { useSettings } from "@/lib/settings-context";
import FullPageLoader from "@/components/common/FullPageLoader";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const { language, setLanguage, setTheme } = useSettings();
  const { resolvedTheme } = useTheme();
  const [loginOpen, setLoginOpen] = useState(false);

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
      <Admin
        isAuthenticated={!!session?.user}
        onOpenLogin={() => setLoginOpen(true)}
        language={language}
        onToggleLanguage={toggleLanguage}
        onToggleTheme={toggleTheme}
      />
      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        callbackUrl="/admin"
      />
    </>
  );
}
