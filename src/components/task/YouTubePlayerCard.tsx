"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Play, Pause, ThumbsUp, MessageSquare, Eye, ExternalLink } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { useDateFormatter } from "@/lib/use-date-formatter";
import { seekKeyToTime } from "@/lib/seek-keyboard";
import type { PublicYouTubeInfo, YouTubeVideoInfo } from "@/types/api";

/**
 * 卡片接受私有 {@link YouTubeVideoInfo} 与公开 {@link PublicYouTubeInfo} 两种来源。
 *
 * 私有侧 channel_id 必填、并带 channel_thumbnail / published_at / 各类计数等富字段;
 * 公开侧 channel_id / channel_title 可空且无富字段。用联合类型让卡片同时吃下两者,
 * 内部对公开侧缺失的字段全部按 optional 守卫(null/undefined → 降级或不渲染),
 * 私有侧传入完整结构时行为与改造前完全一致(零回归)。
 */
type YouTubeCardInfo = YouTubeVideoInfo | PublicYouTubeInfo;

interface YouTubePlayerCardProps {
  youtubeInfo: YouTubeCardInfo;
  sourceUrl?: string;
  currentTime?: number;
  duration: number;
  isPlaying?: boolean;
  onPlayPause?: () => void;
  onSeek?: (time: number) => void;
}

/**
 * 格式化数字为易读形式
 */
function formatCount(count: number | undefined, locale: string): string {
  if (count === undefined || count === null) return "-";

  if (locale === "zh") {
    if (count >= 100000000) {
      return `${(count / 100000000).toFixed(1)}亿`;
    }
    if (count >= 10000) {
      return `${(count / 10000).toFixed(1)}万`;
    }
    return count.toLocaleString("zh-CN");
  }

  if (count >= 1000000000) {
    return `${(count / 1000000000).toFixed(1)}B`;
  }
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toLocaleString("en-US");
}

/**
 * 格式化视频时长
 */
function formatVideoDuration(seconds: number | undefined): string {
  if (seconds === undefined || seconds === null) return "";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export function YouTubePlayerCard({
  youtubeInfo,
  sourceUrl,
  currentTime = 0,
  duration,
  isPlaying = false,
  onPlayPause = () => {},
  onSeek = () => {},
}: YouTubePlayerCardProps) {
  const { t, locale } = useI18n();
  const { formatRelativeTime } = useDateFormatter();

  // Progress bar state
  const [isDragging, setIsDragging] = useState(false);
  const [localTime, setLocalTime] = useState(currentTime);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const displayTime = isDragging ? localTime : currentTime;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * duration;
    setLocalTime(newTime);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const next = seekKeyToTime(e.key, currentTime, duration);
    if (next === null) return;
    e.preventDefault();
    onSeek(next);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!progressBarRef.current) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const newTime = percentage * duration;
      setLocalTime(newTime);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      onSeek(localTime);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [duration, isDragging, localTime, onSeek]);

  const hasValidDuration = duration > 0 && isFinite(duration);
  const progress = hasValidDuration
    ? Math.min(100, Math.max(0, (displayTime / duration) * 100))
    : 0;
  // metadata 加载前 duration 可能是 0/NaN/Infinity：把 slider 的 aria 边界 clamp 到合法区间，
  // 避免读屏宣告成 'NaN'/'Infinity'，也避免 valuenow 超过 valuemax（audit a11y #7）。
  const ariaValueMax = hasValidDuration ? Math.round(duration) : 0;
  const ariaValueNow = Math.min(Math.max(0, Math.round(displayTime)), ariaValueMax);

  const youtubeUrl = sourceUrl || `https://www.youtube.com/watch?v=${youtubeInfo.video_id}`;
  // 红线:channel_id 为 null(公开侧抓取失败)时绝不渲染 /channel/null;只有真有频道 ID 才给链接。
  const channelUrl = youtubeInfo.channel_id
    ? `https://www.youtube.com/channel/${youtubeInfo.channel_id}`
    : null;

  // 富字段仅私有 YouTubeVideoInfo 才有,公开侧没有。窄化为带这些 optional 字段的形状统一读取,
  // 缺失即 undefined → 各处已有 optional 守卫,不渲染对应行/降级。
  // ⚠️ 富字段读取必须保持 optional 守卫:此 cast 不会捕获将来 YouTubeVideoInfo 必填字段漂移,
  //    若新增必填字段须同步在下方加 optional 访问(/undefined 兜底),否则公开侧会取到 undefined。
  const rich = youtubeInfo as Partial<YouTubeVideoInfo>;
  const channelThumbnail = rich.channel_thumbnail;
  const publishedAt = rich.published_at;
  const viewCount = rich.view_count;
  const likeCount = rich.like_count;
  const commentCount = rich.comment_count;

  // 频道信息块:有链接走 <a>,无链接(公开侧无 channel_id)退化为非交互 <div>,布局/内容不变。
  const channelInner = (
    <>
      {channelThumbnail ? (
        <Image
          src={channelThumbnail}
          alt={youtubeInfo.channel_title || "Channel"}
          width={24}
          height={24}
          className="rounded-full flex-shrink-0"
          unoptimized
        />
      ) : (
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
          style={{ background: "var(--app-glass-bg-strong)", color: "var(--app-text-muted)" }}
        >
          {youtubeInfo.channel_title?.[0] || "?"}
        </div>
      )}
      <span
        className="text-sm font-medium truncate"
        style={{ color: "var(--app-player-text)" }}
      >
        {youtubeInfo.channel_title || t("common.unknown")}
      </span>
    </>
  );

  return (
    <div
      className="mx-6 my-4 rounded-xl overflow-hidden"
      style={{ background: "var(--app-player-bg)" }}
    >
      <div className="flex gap-4 p-4">
        {/* Left: Video Thumbnail with Play Button */}
        <div className="relative flex-shrink-0">
          <div className="relative w-44 aspect-video rounded-lg overflow-hidden bg-black/20">
            {youtubeInfo.thumbnail_url && (
              <Image
                src={youtubeInfo.thumbnail_url}
                alt={youtubeInfo.title}
                fill
                className="object-cover"
                sizes="176px"
                unoptimized
              />
            )}
            {/* Duration badge */}
            {youtubeInfo.duration_seconds && (
              <div
                className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-xs font-medium"
                style={{ background: "rgba(0,0,0,0.8)", color: "#fff" }}
              >
                {formatVideoDuration(youtubeInfo.duration_seconds)}
              </div>
            )}
            {/* Play/Pause overlay button */}
            <button
              type="button"
              onClick={onPlayPause}
              aria-label={isPlaying ? t("player.pause") : t("player.play")}
              className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors group"
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                style={{ background: "var(--app-player-text)" }}
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" style={{ color: "var(--app-player-bg)" }} />
                ) : (
                  <Play className="w-6 h-6 ml-0.5" style={{ color: "var(--app-player-bg)" }} />
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Right: Info + Progress */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          {/* Top: Channel info and stats */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* Channel:有 channel_id 走外链 <a>,公开侧无 channel_id 退化为非交互容器(不渲染 /channel/null) */}
              {channelUrl ? (
                <a
                  href={channelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  {channelInner}
                </a>
              ) : (
                <div className="flex items-center gap-2">{channelInner}</div>
              )}

              {/* Stats row */}
              <div
                className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs"
                style={{ color: "var(--app-player-text-muted)" }}
              >
                {publishedAt && (
                  <span>{formatRelativeTime(publishedAt)}</span>
                )}
                {viewCount !== undefined && (
                  <span className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />
                    {formatCount(viewCount, locale)}
                  </span>
                )}
                {likeCount !== undefined && (
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="w-3.5 h-3.5" />
                    {formatCount(likeCount, locale)}
                  </span>
                )}
                {commentCount !== undefined && (
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5" />
                    {formatCount(commentCount, locale)}
                  </span>
                )}
              </div>
            </div>

            {/* YouTube link button */}
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("task.youtubeInfo.openOnYouTube")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-90 flex-shrink-0"
              style={{ background: "#FF0000", color: "#fff" }}
            >
              <span className="hidden sm:inline">{t("task.youtubeInfo.openOnYouTube")}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Bottom: Progress bar */}
          <div className="flex items-center gap-3 mt-3">
            {/* Current Time */}
            <span
              className="text-xs tabular-nums"
              style={{ color: "var(--app-player-text-muted)", minWidth: "40px" }}
            >
              {formatTime(displayTime)}
            </span>

            {/* Progress Bar */}
            <div
              ref={progressBarRef}
              role="slider"
              tabIndex={0}
              aria-label={t("player.seek")}
              aria-valuemin={0}
              aria-valuemax={ariaValueMax}
              aria-valuenow={ariaValueNow}
              aria-valuetext={`${formatTime(displayTime)} / ${formatTime(duration)}`}
              className="flex-1 relative cursor-pointer"
              onMouseDown={handleMouseDown}
              onKeyDown={handleKeyDown}
              style={{ height: "24px" }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 w-full">
                {/* Track */}
                <div
                  className="w-full rounded-full"
                  style={{ height: "4px", background: "var(--app-player-track)" }}
                >
                  {/* Fill */}
                  <div
                    className="h-full rounded-full relative transition-all"
                    style={{ width: `${progress}%`, background: "var(--app-primary)" }}
                  >
                    {/* Knob */}
                    <div
                      className="absolute -right-1.5 top-1/2 -translate-y-1/2 rounded-full transition-transform hover:scale-125"
                      style={{
                        width: "12px",
                        height: "12px",
                        background: "var(--app-player-text)",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Duration */}
            <span
              className="text-xs tabular-nums"
              style={{ color: "var(--app-player-text-muted)", minWidth: "40px" }}
            >
              {formatTime(duration)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default YouTubePlayerCard;
