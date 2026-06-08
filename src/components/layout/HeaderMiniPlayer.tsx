"use client";

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Pause, X } from 'lucide-react';
import { useAudioStore } from '@/store/audio-store';
import { useI18n } from '@/lib/i18n-context';
import { seekKeyToTime } from '@/lib/seek-keyboard';

/**
 * 顶部迷你播放器。
 *
 * 之所以从 Header 独立出来：它是 Header 里唯一逐帧（audio timeupdate → currentTime）
 * 变化的订阅者。把 currentTime/duration/isPlaying 等播放态订阅都关进这里后，Header 外壳
 * （Logo、主题按钮、通知铃、头像菜单 + 全宽 backdrop-filter 毛玻璃）不再随播放每秒重渲染
 * 数次——逐帧重渲染被限制在本组件这一小条内，毛玻璃背板无需反复重新栅格化。
 * 与 TranscriptList 隔离 currentTime 的做法一致。
 */
export default function HeaderMiniPlayer() {
  const router = useRouter();
  const { t } = useI18n();
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);

  const audioTitle = useAudioStore((state) => state.title);
  const audioTaskId = useAudioStore((state) => state.taskId);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const currentTime = useAudioStore((state) => state.currentTime);
  const duration = useAudioStore((state) => state.duration);
  const togglePlayback = useAudioStore((state) => state.toggle);
  const seek = useAudioStore((state) => state.seek);
  const stop = useAudioStore((state) => state.stop);

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
  );
}
