"use client";

import { useCallback, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useTheme } from "next-themes";
import Explore from "@/components/pages/Explore";
import LoginModal from "@/components/auth/LoginModal";
import { useSettingsActions } from "@/lib/settings-context";
import type { PublicTaskListItem } from "@/types/api";

export default function ExplorePageClient({
  initialItems,
  initialTotal,
}: {
  initialItems?: PublicTaskListItem[];
  initialTotal?: number;
}) {
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
      <Explore
        isAuthenticated={!!authUser}
        onOpenLogin={openLoginModal}
        onToggleTheme={toggleTheme}
        initialItems={initialItems}
        initialTotal={initialTotal}
      />
      <LoginModal isOpen={showLoginModal} onClose={closeLoginModal} callbackUrl="/explore" />
    </>
  );
}
