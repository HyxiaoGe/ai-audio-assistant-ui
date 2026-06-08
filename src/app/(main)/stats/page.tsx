"use client";

import { useCallback, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useTheme } from "next-themes";
import Stats from "@/components/pages/Stats";
import LoginModal from "@/components/auth/LoginModal";
import { useSettings } from "@/lib/settings-context";
import FullPageLoader from "@/components/common/FullPageLoader";

export default function StatsPage() {
  const authUser = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const { setTheme } = useSettings();
  const { resolvedTheme } = useTheme();
  const [loginOpen, setLoginOpen] = useState(false);

  // 用 useCallback 稳定 handler 身份，避免重渲染（如开关登录弹窗、切主题）把新函数
  // 传给 Stats，连带触发其统计拉取 effect 重跑等无谓请求。
  const openLoginModal = useCallback(() => setLoginOpen(true), []);
  const closeLoginModal = useCallback(() => setLoginOpen(false), []);
  const toggleTheme = useCallback(
    () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
    [resolvedTheme, setTheme],
  );

  if (status === "loading") {
    return <FullPageLoader />;
  }

  return (
    <>
      <Stats
        isAuthenticated={!!authUser}
        onOpenLogin={openLoginModal}
        onToggleTheme={toggleTheme}
      />
      <LoginModal
        isOpen={loginOpen}
        onClose={closeLoginModal}
        callbackUrl="/stats"
      />
    </>
  );
}
