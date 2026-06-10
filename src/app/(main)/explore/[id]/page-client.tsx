"use client";

import { useCallback, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useTheme } from "next-themes";
import PublicTaskDetail from "@/components/pages/PublicTaskDetail";
import LoginModal from "@/components/auth/LoginModal";
import { useSettingsActions } from "@/lib/settings-context";
import type { PublicSummaryResponse, PublicTaskDetail as PublicTaskDetailData } from "@/types/api";

interface PublicTaskDetailPageClientProps {
  id: string;
  /** 服务器组件经内网 LAN 预取的初值;预取失败时为 undefined,客户端 loader 兜底照常拉。 */
  initialDetail?: PublicTaskDetailData;
  initialSummary?: PublicSummaryResponse;
}

/**
 * 公开详情页客户端壳:登录弹窗 / 主题切换等纯客户端交互留在这里,
 * 数据预取已上移到服务器组件 page.tsx(经容器内网消掉隧道往返)。
 */
export default function PublicTaskDetailPageClient({
  id,
  initialDetail,
  initialSummary,
}: PublicTaskDetailPageClientProps) {
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
      {/* key={id} 让 id 切换时整棵子树重挂,三 state 天然清零,防止 A→B 路由时 A 的在途响应写进 B 的 state */}
      <PublicTaskDetail
        key={id}
        isAuthenticated={!!authUser}
        onOpenLogin={openLoginModal}
        onToggleTheme={toggleTheme}
        initialDetail={initialDetail}
        initialSummary={initialSummary}
      />
      <LoginModal isOpen={showLoginModal} onClose={closeLoginModal} callbackUrl={`/explore/${id}`} />
    </>
  );
}
