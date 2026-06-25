"use client";

import type React from "react";
import Link from "next/link";
import { BarChart3, Settings, List, LineChart, Youtube, Shield, Compass, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n-context";
import { useUserStore } from "@/store/user-store";
import { useAuthStore } from "@/store/auth-store";

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  path: string;
  isActive: boolean;
}

function SidebarItem({ icon, label, path, isActive }: SidebarItemProps) {
  return (
    <Link
      href={path}
      className="sidebar-item relative"
      data-active={isActive}
      aria-current={isActive ? "page" : undefined}
    >
      <div className="w-5 h-5 flex items-center justify-center">{icon}</div>
      <span>{label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const isAdmin = useUserStore((state) => state.isAdmin);
  // 登录态：未登录时侧栏只保留「探索」这一公开入口，其余项点了都会被弹去登录、属噪音。
  const authUser = useAuthStore((s) => s.user);
  const isAuthenticated = !!authUser;

  // public:true 的项在未登录时仍展示（当前仅「探索」）。已登录展示全部项。
  const menuItems = [
    { icon: <BarChart3 className="w-5 h-5" />, label: t("nav.overview"), path: "/" },
    { icon: <List className="w-5 h-5" />, label: t("nav.tasks"), path: "/tasks" },
    { icon: <Compass className="w-5 h-5" />, label: t("nav.explore"), path: "/explore", public: true },
    { icon: <Search className="w-5 h-5" />, label: t("nav.discover"), path: "/discover", public: true },
    { icon: <Youtube className="w-5 h-5" />, label: t("nav.subscriptions"), path: "/subscriptions" },
    { icon: <LineChart className="w-5 h-5" />, label: t("nav.stats"), path: "/stats" },
    { icon: <Settings className="w-5 h-5" />, label: t("nav.settings"), path: "/settings" },
  ];

  // 未登录（含登录态尚未解析、user 仍为 null 的瞬间）只保留公开项，避免「先全量→塌缩成单项」的回退。
  const visibleItems = isAuthenticated ? menuItems : menuItems.filter((item) => item.public);

  // 判断当前路径应该高亮哪个菜单项
  const isActive = (itemPath: string) => {
    if (itemPath === "/") return pathname === "/";
    if (itemPath === "/tasks") return pathname === "/tasks" || pathname.startsWith("/tasks/");
    if (itemPath === "/stats") return pathname === "/stats" || pathname.startsWith("/stats/");
    if (itemPath === "/subscriptions") return pathname === "/subscriptions" || pathname.startsWith("/subscriptions/");
    // 注意：/admin 分支由底部 admin 项调用（isActive("/admin")），不是死代码，保留。
    if (itemPath === "/admin") return pathname === "/admin" || pathname.startsWith("/admin/");
    if (itemPath === "/explore") return pathname === "/explore" || pathname.startsWith("/explore/");
    if (itemPath === "/discover") return pathname === "/discover" || pathname.startsWith("/discover/");
    return pathname === itemPath;
  };

  return (
    <nav
      aria-label={t("nav.primary")}
      className="w-60 h-full p-4 flex flex-col"
      style={{
        background: "var(--app-glass-bg)",
        borderRight: "1px solid var(--app-glass-border)",
        backdropFilter: `blur(var(--app-glass-blur))`,
        boxShadow: "var(--app-glass-shadow)",
      }}
    >
      <div className="space-y-1 flex-1">
        {visibleItems.map((item) => (
          <SidebarItem
            key={item.path}
            icon={item.icon}
            label={item.label}
            path={item.path}
            isActive={isActive(item.path)}
          />
        ))}
      </div>

      {/* Admin section at bottom（仅已登录的管理员） */}
      {isAuthenticated && isAdmin && (
        <div className="pt-4 border-t" style={{ borderColor: "var(--app-glass-border)" }}>
          <SidebarItem
            icon={<Shield className="w-5 h-5" />}
            label={t("admin.console")}
            path="/admin"
            isActive={isActive("/admin")}
          />
        </div>
      )}
    </nav>
  );
}
