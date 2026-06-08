"use client";

import { memo, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { Moon, Sun, ChevronDown, Mic, LogOut } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useI18n } from '@/lib/i18n-context';
import { useTheme } from "next-themes";
import NotificationBell from '@/components/notifications/NotificationBell';
import { useAudioStore } from '@/store/audio-store';
import { useUserStore } from '@/store/user-store';
import { proxiedAvatar } from '@/lib/avatar-url';
import HeaderMiniPlayer from '@/components/layout/HeaderMiniPlayer';

interface HeaderProps {
  isAuthenticated: boolean;
  onOpenLogin: () => void;
  onToggleTheme?: () => void;
}

function Header({
  isAuthenticated,
  onOpenLogin,
  onToggleTheme = () => {}
}: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const authUser = useAuthStore((s) => s.user);
  const authStatus = useAuthStore((s) => s.status);
  const authLogout = useAuthStore((s) => s.logout);
  const { t } = useI18n();
  const { resolvedTheme } = useTheme();
  const pathname = usePathname();
  // 仅订阅决定「是否显示迷你播放器」所需的 src/taskId（极少变化）；逐帧跳动的
  // currentTime/duration/isPlaying 等播放态订阅都下沉到 HeaderMiniPlayer 子组件，
  // 使 Header 外壳（含全宽毛玻璃）不再随播放每秒重渲染。
  const audioSrc = useAudioStore((state) => state.src);
  const audioTaskId = useAudioStore((state) => state.taskId);
  const isDark = resolvedTheme === "dark";
  const [avatarSrc, setAvatarSrc] = useState("");
  const avatarName = authUser?.name || authUser?.email || "U";
  const resolvedAvatarSrc = avatarSrc || authUser?.avatar_url || "";

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  const loadUserProfile = useUserStore((state) => state.loadProfile);
  const userProfile = useUserStore((state) => state.profile);
  const profileLoaded = useUserStore((state) => state.profileLoaded);
  const isAdmin = useUserStore((state) => state.isAdmin);

  useEffect(() => {
    if (!authUser) return;
    // Load profile into global store
    if (!profileLoaded) {
      loadUserProfile();
    }
  }, [authUser, profileLoaded, loadUserProfile]);

  useEffect(() => {
    // Update avatar from user profile
    if (userProfile?.image_url) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvatarSrc(userProfile.image_url);
    }
  }, [userProfile]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target)) {
        setIsMenuOpen(false);
      }
    };
    // 键盘可关闭：Escape 收起菜单并把焦点还原到触发按钮（避免键盘陷阱，符合菜单 Esc 约定）。
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        menuTriggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  const handleLogout = async () => {
    // 全局单点登出：authLogout() 委托 SDK 顶层表单 POST 到 /auth/logout 销毁共享 IdP 会话，
    // auth-service 再 302 裸回跳 /auth/callback → /login。不再 router.push('/login')，
    // 避免客户端跳转与整页表单导航相互竞态。
    await authLogout();
  };

  const pathSegments = pathname.split("/").filter(Boolean);
  const currentTaskId = pathSegments[0] === "tasks" && pathSegments[1] ? pathSegments[1] : null;
  const showMiniPlayer = Boolean(audioSrc) && (!currentTaskId || currentTaskId !== audioTaskId);

  return (
    <header 
      className="h-16 flex items-center justify-between px-6 sticky top-0 z-40"
      style={{ 
        background: "var(--app-glass-bg)",
        borderBottom: "1px solid var(--app-glass-border)",
        backdropFilter: "blur(var(--app-glass-blur))"
      }}
    >
      {/* 左侧：Logo + 产品名称 */}
      <Link href="/" className="flex items-center gap-2">
        <div 
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: "var(--app-brand-gradient)" }}
        >
          <Mic className="w-4 h-4 text-white" />
        </div>
        <span 
          className="text-base"
          style={{ fontWeight: 600, color: "var(--app-text)" }}
        >
          {t("app.name")}
        </span>
      </Link>

      {/* 右侧：功能按钮组 */}
      <div className="flex items-center gap-4">
        {showMiniPlayer && <HeaderMiniPlayer />}
        {/* 主题切换 */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="w-6 h-6 flex items-center justify-center transition-all hover:opacity-70 duration-300"
          style={{
            color: isMounted && isDark ? "var(--app-warning)" : "var(--app-primary)",
            transform: isMounted && isDark ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
          aria-label={isMounted && isDark ? t("header.switchToLight") : t("header.switchToDark")}
          title={isMounted && isDark ? t("header.switchToLight") : t("header.switchToDark")}
        >
          {isMounted && isDark ? (
            <Sun className="w-5 h-5" aria-hidden="true" />
          ) : (
            <Moon className="w-5 h-5" aria-hidden="true" />
          )}
        </button>

        {/* 通知 - 使用新的全局 WebSocket 通知系统 */}
        <NotificationBell />

        {/* 用户头像 + 下拉 */}
        {authStatus === "loading" ? (
          <div className="flex items-center gap-2 opacity-70">
            <div
              className="size-8 rounded-full"
              style={{ background: "var(--app-glass-bg-strong)" }}
            />
            <div
              className="h-2 w-4 rounded"
              style={{ background: "var(--app-glass-bg-strong)" }}
            />
          </div>
        ) : isAuthenticated ? (
          <div className="relative" ref={menuRef}>
            <button
              ref={menuTriggerRef}
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-label={t("header.userMenu")}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity"
            >
              <div className={`relative ${isAdmin ? "admin-gradient-ring" : ""}`}>
                <Avatar size="sm">
                  <AvatarImage
                    src={proxiedAvatar(resolvedAvatarSrc) || undefined}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarSrc("")}
                  />
                  <AvatarFallback>{avatarName.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              </div>
              <ChevronDown className="w-4 h-4" style={{ color: "var(--app-text-subtle)" }} aria-hidden="true" />
            </button>

            {isMenuOpen && (
              <div
                role="menu"
                aria-label={t("header.userMenu")}
                className="glass-panel-strong absolute right-0 mt-2 w-40 rounded-lg border z-10 overflow-hidden"
                style={{ borderColor: "var(--app-glass-border)" }}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="w-full px-3 py-2 flex items-center gap-2 text-sm transition-colors hover:bg-[var(--app-sidebar-item-hover)]"
                  style={{ color: "var(--app-text)" }}
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                  {t("auth.logout")}
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenLogin}
            className="glass-control px-4 py-2 rounded-lg"
            style={{
              color: "var(--app-text)",
              fontSize: '14px',
              fontWeight: 500
            }}
          >
            {t("auth.login")}
          </button>
        )}
      </div>
    </header>
  );
}

export default memo(Header);
