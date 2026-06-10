"use client";

import { useCallback, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useTheme } from "next-themes";
import PublicTaskDetail from "@/components/pages/PublicTaskDetail";
import LoginModal from "@/components/auth/LoginModal";
import { useSettingsActions } from "@/lib/settings-context";

export default function PublicTaskDetailPage() {
  const authUser = useAuthStore((s) => s.user);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const { setTheme } = useSettingsActions();
  const { resolvedTheme } = useTheme();
  const openLoginModal = useCallback(() => setShowLoginModal(true), []);
  const closeLoginModal = useCallback(() => setShowLoginModal(false), []);
  const toggleTheme = useCallback(
    () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
    [resolvedTheme, setTheme],
  );

  return (
    <>
      <PublicTaskDetail
        isAuthenticated={!!authUser}
        onOpenLogin={openLoginModal}
        onToggleTheme={toggleTheme}
      />
      <LoginModal isOpen={showLoginModal} onClose={closeLoginModal} callbackUrl="/explore" />
    </>
  );
}
