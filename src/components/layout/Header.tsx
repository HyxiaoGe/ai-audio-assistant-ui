"use client";

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { Moon, Sun, ChevronDown, Mic, LogOut, Play, Pause, X } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useI18n } from '@/lib/i18n-context';
import { useTheme } from "next-themes";
import NotificationBell from '@/components/notifications/NotificationBell';
import { useAudioStore } from '@/store/audio-store';
import { useUserStore } from '@/store/user-store';
import { seekKeyToTime } from '@/lib/seek-keyboard';

interface HeaderProps {
  isAuthenticated: boolean;
  onOpenLogin: () => void;
  onToggleTheme?: () => void;
}

export default function Header({
  isAuthenticated,
  onOpenLogin,
  onToggleTheme = () => {}
}: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const authUser = useAuthStore((s) => s.user);
  const authStatus = useAuthStore((s) => s.status);
  const authLogout = useAuthStore((s) => s.logout);
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
    await authLogout();
    router.push('/login');
  };

  const pathSegments = pathname.split("/").filter(Boolean);
  const currentTaskId = pathSegments[0] === "tasks" && pathSegments[1] ? pathSegments[1] : null;
  const showMiniPlayer = Boolean(audioSrc) && (!currentTaskId || currentTaskId !== audioTaskId);
  const displayTitle = audioTitle || t("audio.untitled");
  const shouldMarquee = displayTitle.length > 10;
  const marqueeDuration = Math.min(Math.max(displayTitle.length * 0.45, 7), 15);
  const hasValidDuration = duration > 0 && isFinite(duration);
  const progress = hasValidDuration
    ? Math.min(100, Math.max(0, (currentTime / duration) * 100))
    : 0;
  // metadata 加载前 duration 可能是 0/NaN/Infinity：clamp slider 的 aria 边界，
  // 避免读屏宣告 'NaN'/'Infinity'，也避免 valuenow 超过 valuemax（audit a11y #7）。
  const ariaValueMax = hasValidDuration ? Math.round(duration) : 0;
  const ariaValueNow = Math.min(Math.max(0, Math.round(currentTime)), ariaValueMax);

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

  const handleProgressHover = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || !isFinite(duration)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    setHoverRatio(ratio);
  };

  const handleProgressLeave = () => {
    setHoverRatio(null);
  };

  // 键盘 seek：与 PlayerBar 共用 seekKeyToTime（方向键 ±5s / PageUp-Down ±10s / Home-End）。
  const handleProgressKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const next = seekKeyToTime(event.key, currentTime, duration);
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    seek(next);
  };

  const handleMiniPlayerClick = () => {
    if (!audioTaskId) return;
    router.push(`/tasks/${audioTaskId}`);
  };

  // 整行「打开任务」键盘可达：仅当焦点在容器本身时响应 Enter/Space，
  // 内部播放/进度条/停止按钮的按键事件冒泡上来时 target!==currentTarget，不会误触跳转。
  const handleMiniPlayerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleMiniPlayerClick();
    }
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
            onKeyDown={handleMiniPlayerKeyDown}
            role="button"
            tabIndex={0}
            aria-label={t("audio.openTask")}
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                togglePlayback();
              }}
              aria-label={isPlaying ? t("player.pause") : t("player.play")}
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
              onMouseMove={handleProgressHover}
              onMouseLeave={handleProgressLeave}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={handleProgressKeyDown}
              role="slider"
              tabIndex={0}
              aria-label={t('player.seek')}
              aria-valuemin={0}
              aria-valuemax={ariaValueMax}
              aria-valuenow={ariaValueNow}
              aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}`}
              style={{ width: '110px', height: '8px' }}
            >
              {hoverRatio !== null && duration > 0 && isFinite(duration) && (
                <div
                  className="absolute -top-6"
                  style={{ left: `${hoverRatio * 100}%`, transform: 'translateX(-50%)' }}
                >
                  <div
                    className="rounded px-1.5 py-0.5 text-[10px] border"
                    style={{
                      background: "var(--app-glass-bg-strong)",
                      borderColor: "var(--app-glass-border)",
                      color: "var(--app-text)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatTime(hoverRatio * duration)}
                  </div>
                </div>
              )}
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
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                stop();
              }}
              className="size-6 flex items-center justify-center rounded-full transition-colors hover:bg-[var(--app-glass-hover)]"
              style={{ color: "var(--app-text-muted)" }}
              aria-label={t("common.dismiss")}
              title={t("common.dismiss")}
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
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
                    src={resolvedAvatarSrc || undefined}
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
