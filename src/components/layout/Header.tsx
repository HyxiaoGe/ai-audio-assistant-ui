"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { clearToken } from '@/lib/auth-token';
import { Moon, Sun, ChevronDown, Mic, LogOut } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useI18n } from '@/lib/i18n-context';
import { useTheme } from "next-themes";
import { useAPIClient } from "@/lib/use-api-client";
import NotificationBell from '@/components/notifications/NotificationBell';

interface HeaderProps {
  isAuthenticated: boolean;
  onOpenLogin: () => void;
  language?: 'zh' | 'en';
  onToggleLanguage?: () => void;
  onToggleTheme?: () => void;
}

export default function Header({ 
  isAuthenticated, 
  onOpenLogin,
  language = 'zh',
  onToggleLanguage = () => {},
  onToggleTheme = () => {}
}: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { data: session, update } = useSession();
  const client = useAPIClient();
  const { t } = useI18n();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [avatarSrc, setAvatarSrc] = useState("");
  const avatarName = session?.user?.name || session?.user?.email || "U";
  const resolvedAvatarSrc = avatarSrc || session?.user?.image || "";

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    let isMounted = true;
    const loadProfile = async () => {
      try {
        const profile = await client.getCurrentUser();
        if (!isMounted) return;
        if (profile?.image_url) {
          setAvatarSrc(profile.image_url);
          if (!session.user?.image && typeof update === "function") {
            await update({ user: { image: profile.image_url } });
          }
        }
      } catch {
        // Fallback to session user image if profile fetch fails.
      }
    };
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [client, session?.user, update]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleLogout = async () => {
    clearToken();
    await signOut({ callbackUrl: '/' });
  };
  
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
        {/* 语言切换 */}
        <button 
          onClick={onToggleLanguage}
          className="text-sm transition-all hover:opacity-70 px-2 py-1 rounded"
          style={{ color: "var(--app-text-muted)" }}
        >
          {language === 'zh' ? t("header.languageToggleZh") : t("header.languageToggleEn")}
        </button>

        {/* 主题切换 */}
        <button 
          onClick={onToggleTheme}
          className="w-6 h-6 flex items-center justify-center transition-all hover:opacity-70 duration-300"
          style={{ 
            color: isMounted && isDark ? "var(--app-warning)" : "var(--app-primary)",
            transform: isMounted && isDark ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
          title={isMounted && isDark ? t("header.switchToLight") : t("header.switchToDark")}
        >
          {isMounted && isDark ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </button>

        {/* 通知 - 使用新的全局 WebSocket 通知系统 */}
        <NotificationBell />

        {/* 用户头像 + 下拉 */}
        {isAuthenticated ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity"
            >
              <Avatar size="sm">
                <AvatarImage
                  src={resolvedAvatarSrc || undefined}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarSrc("")}
                />
                <AvatarFallback>{avatarName.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <ChevronDown className="w-4 h-4" style={{ color: "var(--app-text-subtle)" }} />
            </button>

            {isMenuOpen && (
              <div
                className="glass-panel-strong absolute right-0 mt-2 w-36 rounded-lg border z-10"
                style={{ borderColor: "var(--app-glass-border)" }}
              >
                <button
                  onClick={handleLogout}
                  className="w-full px-3 py-2 flex items-center gap-2 text-sm transition-colors hover:bg-[var(--app-glass-hover)]"
                  style={{ color: "var(--app-text)" }}
                >
                  <LogOut className="w-4 h-4" />
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
