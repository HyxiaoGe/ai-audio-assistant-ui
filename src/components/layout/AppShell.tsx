"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import LoginModal from "@/components/auth/LoginModal";
import NewTaskModal from "@/components/task/NewTaskModal";
import { useUIStore } from "@/store/ui-store";

/**
 * 全站唯一持久外壳：路由切换时不卸载重挂（保住滚动位置、消除闪烁）。
 * <main> 只做滚动容器、不带内容 padding——各页内容根自带 padding/布局。
 * 全局 LoginModal / NewTaskModal 由 ui-store 驱动；登录回跳目标取当前 pathname。
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const loginOpen = useUIStore((s) => s.loginOpen);
  const closeLogin = useUIStore((s) => s.closeLogin);
  const newTaskOpen = useUIStore((s) => s.newTaskOpen);
  const newTaskInitial = useUIStore((s) => s.newTaskInitial);
  const closeNewTask = useUIStore((s) => s.closeNewTask);

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--app-bg)" }}>
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto" style={{ background: "var(--app-bg)" }}>
          {children}
        </main>
      </div>

      <LoginModal isOpen={loginOpen} onClose={closeLogin} callbackUrl={pathname} />
      <NewTaskModal
        isOpen={newTaskOpen}
        onClose={closeNewTask}
        initialVideoUrl={newTaskInitial?.initialVideoUrl}
        initialYouTubeVideoId={newTaskInitial?.initialYouTubeVideoId}
      />
    </div>
  );
}
