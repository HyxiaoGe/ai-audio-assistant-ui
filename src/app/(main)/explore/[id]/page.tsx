"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { useTheme } from "next-themes";
import PublicTaskDetail from "@/components/pages/PublicTaskDetail";
import LoginModal from "@/components/auth/LoginModal";
import { useSettingsActions } from "@/lib/settings-context";

export default function PublicTaskDetailPage() {
  const authUser = useAuthStore((s) => s.user);
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
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
      {/* key={id} 让 id 切换时整棵子树重挂,三 state 天然清零,防止 A→B 路由时 A 的在途响应写进 B 的 state */}
      <PublicTaskDetail
        key={id}
        isAuthenticated={!!authUser}
        onOpenLogin={openLoginModal}
        onToggleTheme={toggleTheme}
      />
      <LoginModal isOpen={showLoginModal} onClose={closeLoginModal} callbackUrl={`/explore/${id}`} />
    </>
  );
}
