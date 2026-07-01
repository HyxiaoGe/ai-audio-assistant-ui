"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { zhCN, enUS } from "date-fns/locale";
import { Play, ExternalLink, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n-context";
import { YouTubeVideoItem } from "@/types/api";

interface VideoCardProps {
  video: YouTubeVideoItem;
  channelThumbnail?: string;
  channelTitle?: string;
  showChannel?: boolean;
  /** Called when user clicks transcribe button, passes the YouTube video URL */
  onTranscribe?: (videoUrl: string, videoId: string) => void;
}

/**
 * Format video duration from seconds to HH:MM:SS or MM:SS
 */
function formatDuration(seconds?: number): string {
  if (!seconds) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format view count with K/M suffix
 */
function formatViewCount(count?: number): string {
  if (!count) return "";
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

export default function VideoCard({
  video,
  channelThumbnail,
  channelTitle,
  showChannel = true,
  onTranscribe,
}: VideoCardProps) {
  const { t, locale } = useI18n();
  const router = useRouter();

  const dateLocale = locale.startsWith("zh") ? zhCN : enUS;

  const handleTranscribe = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (video.transcribed) return;

    // Build YouTube URL and call the callback
    const videoUrl = `https://www.youtube.com/watch?v=${video.video_id}`;
    onTranscribe?.(videoUrl, video.video_id);
  };

  const handleTranscribeAnyway = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const videoUrl = `https://www.youtube.com/watch?v=${video.video_id}`;
    onTranscribe?.(videoUrl, video.video_id);
  };

  const handleViewTask = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (video.task_id) {
      router.push(`/tasks/${video.task_id}`);
    }
  };

  // 别人的公开任务走公开详情 /explore/[id](匿名/非 owner 可看);/tasks/[id] 是 owner-gated
  // 私有详情——非 owner 会被 middleware 弹登录或 getTask 404。约定同 PublicTaskList(is_owner ? /tasks : /explore)。
  const handleViewPublic = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (video.task_id) {
      router.push(`/explore/${video.task_id}`);
    }
  };

  const handleOpenYouTube = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    window.open(`https://www.youtube.com/watch?v=${video.video_id}`, "_blank");
  };

  return (
    <div
      className="group relative rounded-xl border overflow-hidden transition-all hover:shadow-md"
      style={{
        borderColor: "var(--app-glass-border)",
        background: "var(--app-glass-bg)",
      }}
    >
      {/* Thumbnail with duration badge */}
      <div className="relative aspect-video bg-black/10">
        {video.thumbnail_url ? (
          <Image
            src={video.thumbnail_url}
            alt={video.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play
              className="w-12 h-12"
              style={{ color: "var(--app-text-muted)" }}
            />
          </div>
        )}

        {/* Duration badge */}
        {video.duration_seconds != null && video.duration_seconds > 0 && (
          <span
            className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-xs font-medium"
            style={{
              background: "rgba(0,0,0,0.8)",
              color: "white",
            }}
          >
            {formatDuration(video.duration_seconds)}
          </span>
        )}

        {/* Hover overlay with YouTube link */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={handleOpenYouTube}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            aria-label={t("subscriptions.openOnYouTube")}
            title={t("subscriptions.openOnYouTube")}
          >
            <ExternalLink className="w-5 h-5 text-white" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        {/* Title */}
        <h3
          className="text-sm font-medium line-clamp-2 min-h-[2.5rem]"
          style={{ color: "var(--app-text)" }}
          title={video.title}
        >
          {video.title}
        </h3>

        {/* Channel info (optional) */}
        {showChannel && (channelTitle || video.channel_id) && (
          <div className="flex items-center gap-2">
            {channelThumbnail && (
              <Image
                src={channelThumbnail}
                alt=""
                width={20}
                height={20}
                className="w-5 h-5 rounded-full"
                unoptimized
              />
            )}
            <span
              className="text-xs truncate"
              style={{ color: "var(--app-text-muted)" }}
            >
              {channelTitle || video.channel_id}
            </span>
          </div>
        )}

        {/* Meta info */}
        <div
          className="flex items-center gap-2 text-xs"
          style={{ color: "var(--app-text-muted)" }}
        >
          {video.view_count != null && video.view_count > 0 && (
            <span>{t("subscriptions.videoViews", { count: formatViewCount(video.view_count) })}</span>
          )}
          {video.view_count != null && video.view_count > 0 && video.published_at && (
            <span>·</span>
          )}
          {video.published_at && (
            <span>
              {formatDistanceToNow(new Date(video.published_at), {
                addSuffix: true,
                locale: dateLocale,
              })}
            </span>
          )}
        </div>

        {/* Transcribe / view button(三态:自己已转 · 别人已公开 · 未转) */}
        <div className="pt-1">
          {video.transcribed ? (
            video.existing_is_owner === false ? (
              // 别人已公开:主按钮跳公开页查看 + 次级仍要自己转写
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleViewPublic}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5 text-[var(--app-success)]" />
                  {t("discover.existingPublicView")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleTranscribeAnyway}
                >
                  {t("discover.transcribeAnyway")}
                </Button>
              </div>
            ) : (
              // 自己的 / 订阅feed 旧用法:查看任务
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleViewTask}
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5 text-[var(--app-success)]" />
                {t("subscriptions.viewTask")}
              </Button>
            )
          ) : (
            <Button
              variant="default"
              size="sm"
              className="w-full"
              onClick={handleTranscribe}
            >
              {t("subscriptions.transcribeButton")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
