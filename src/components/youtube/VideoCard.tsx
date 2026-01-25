"use client";

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
  onTranscribe?: (videoUrl: string) => void;
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
    onTranscribe?.(videoUrl);
  };

  const handleViewTask = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (video.task_id) {
      router.push(`/tasks/${video.task_id}`);
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
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className="w-full h-full object-cover"
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
            onClick={handleOpenYouTube}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            title={t("subscriptions.openOnYouTube")}
          >
            <ExternalLink className="w-5 h-5 text-white" />
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
              <img
                src={channelThumbnail}
                alt=""
                className="w-5 h-5 rounded-full"
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

        {/* Transcribe button */}
        <div className="pt-1">
          {video.transcribed ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleViewTask}
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5 text-[var(--app-success)]" />
              {t("subscriptions.viewTask")}
            </Button>
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
