"use client";

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { clearToken } from '@/lib/auth-token';
import { Moon, Sun, ChevronDown, Mic, LogOut, Play, Pause, X } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useI18n } from '@/lib/i18n-context';
import { useTheme } from "next-themes";
import { useAPIClient } from "@/lib/use-api-client";
import NotificationBell from '@/components/notifications/NotificationBell';
import { useAudioStore } from '@/store/audio-store';

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
  const { data: session, status: sessionStatus, update } = useSession();
  const client = useAPIClient();
  const { t } = useI18n();
  const { resolvedTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const audioSrc = useAudioStore((state) => state.src);
  const audioTitle = useAudioStore((state) => state.title);
  const audioTaskId = useAudioStore((state) => state.taskId);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const currentTime = useAudioStore((state) => state.currentTime);
  const duration = useAudioStore((state) => state.duration);
  const togglePlayback = useAudioStore((state) => state.toggle);
  const seek = useAudioStore((state) => state.seek);
  const stop = useAudioStore((state) => state.stop);
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

  const pathSegments = pathname.split("/").filter(Boolean);
  const currentTaskId = pathSegments[0] === "tasks" && pathSegments[1] ? pathSegments[1] : null;
  const showMiniPlayer = Boolean(audioSrc) && (!currentTaskId || currentTaskId !== audioTaskId);
  const displayTitle = audioTitle || t("audio.untitled");
  const shouldMarquee = displayTitle.length > 10;
  const marqueeDuration = Math.min(Math.max(displayTitle.length * 0.45, 7), 15);
  const progress = duration > 0 && isFinite(duration)
    ? Math.min(100, Math.max(0, (currentTime / duration) * 100))
    : 0;

  const formatTime = (seconds: number) => {
    if (!seconds || !isFinite(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || !isFinite(duration)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    seek(ratio * duration);
  };

  const handleMiniPlayerClick = () => {
    if (!audioTaskId) return;
    router.push(`/tasks/${audioTaskId}`);
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
        {showMiniPlayer && (
          <div
            className="hidden lg:flex items-center gap-2 rounded-full px-3 py-1.5 glass-control cursor-pointer"
            onClick={handleMiniPlayerClick}
          >
            <button
              onClick={(event) => {
                event.stopPropagation();
                togglePlayback();
              }}
              className="size-6 flex items-center justify-center rounded-full transition-transform hover:scale-105"
              style={{ background: "var(--app-glass-bg)" }}
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5" style={{ color: "var(--app-text)" }} />
              ) : (
                <Play className="w-3.5 h-3.5 ml-0.5" style={{ color: "var(--app-text)" }} />
              )}
            </button>

            <div
              className="mini-player-title text-[11px]"
              style={{ color: "var(--app-text-muted)" }}
              title={displayTitle}
            >
              <span
                className={shouldMarquee ? "mini-player-title-track" : "mini-player-title-static"}
                style={shouldMarquee ? ({ "--marquee-duration": `${marqueeDuration}s` } as CSSProperties) : undefined}
              >
                {displayTitle}
              </span>
            </div>

            <span className="text-[11px] tabular-nums" style={{ color: "var(--app-text-muted)", minWidth: '36px' }}>
              {formatTime(currentTime)}
            </span>

            <div
              className="relative cursor-pointer"
              onMouseDown={(event) => {
                event.stopPropagation();
                handleSeek(event);
              }}
              onClick={(event) => event.stopPropagation()}
              style={{ width: '110px', height: '8px' }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 w-full">
                <div
                  className="w-full rounded-full"
                  style={{ height: '3px', background: "var(--app-text-faint)" }}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-200"
                    style={{ width: `${progress}%`, background: "var(--app-primary)" }}
                  />
                </div>
              </div>
            </div>

            <span className="text-[11px] tabular-nums" style={{ color: "var(--app-text-muted)", minWidth: '36px' }}>
              {formatTime(duration)}
            </span>

            <button
              onClick={(event) => {
                event.stopPropagation();
                stop();
              }}
              className="size-6 flex items-center justify-center rounded-full transition-colors hover:bg-[var(--app-glass-hover)]"
              style={{ color: "var(--app-text-muted)" }}
              title={t("common.dismiss")}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
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
        {sessionStatus === "loading" ? (
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
