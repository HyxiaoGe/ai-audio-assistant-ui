"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { zhCN, enUS } from "date-fns/locale";
import { RefreshCw, ExternalLink, Video as VideoIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import VideoCard from "./VideoCard";
import { useI18n } from "@/lib/i18n-context";
import { useAPIClient } from "@/lib/use-api-client";
import { notifySuccess, notifyError } from "@/lib/notify";
import {
  ApiError,
  YouTubeChannelSyncStatus,
  YouTubeSubscriptionItem,
  YouTubeVideoItem,
} from "@/types/api";

interface ChannelDetailDialogProps {
  channel: YouTubeSubscriptionItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ChannelDetailDialog({
  channel,
  open,
  onOpenChange,
}: ChannelDetailDialogProps) {
  const { t, locale } = useI18n();
  const client = useAPIClient();

  // Sync status
  const [syncStatus, setSyncStatus] = useState<YouTubeChannelSyncStatus | null>(null);
  const [syncStatusLoading, setSyncStatusLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Videos
  const [videos, setVideos] = useState<YouTubeVideoItem[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [videosTotal, setVideosTotal] = useState(0);
  const [videosPage, setVideosPage] = useState(1);
  const [videosError, setVideosError] = useState<string | null>(null);

  const PAGE_SIZE = 12;
  const dateLocale = locale.startsWith("zh") ? zhCN : enUS;

  // Load sync status
  const loadSyncStatus = useCallback(async () => {
    if (!channel) return;

    setSyncStatusLoading(true);
    try {
      const status = await client.getYouTubeChannelSyncStatus(channel.channel_id);
      setSyncStatus(status);
    } catch (error) {
      console.error("Failed to load channel sync status:", error);
      setSyncStatus(null);
    } finally {
      setSyncStatusLoading(false);
    }
  }, [client, channel]);

  // Load videos
  const loadVideos = useCallback(
    async (page: number = 1, append: boolean = false) => {
      if (!channel) return;

      setVideosLoading(true);
      setVideosError(null);
      try {
        const result = await client.getYouTubeChannelVideos(channel.channel_id, {
          page,
          page_size: PAGE_SIZE,
        });
        if (append) {
          setVideos((prev) => [...prev, ...result.items]);
        } else {
          setVideos(result.items);
        }
        setVideosTotal(result.total);
        setVideosPage(page);
      } catch (error) {
        const message =
          error instanceof ApiError ? error.message : t("subscriptions.loadFailed");
        setVideosError(message);
      } finally {
        setVideosLoading(false);
      }
    },
    [client, channel, t]
  );

  // Load data when dialog opens
  useEffect(() => {
    if (open && channel) {
      loadSyncStatus();
      loadVideos(1, false);
    } else {
      // Reset state when dialog closes
      setSyncStatus(null);
      setVideos([]);
      setVideosTotal(0);
      setVideosPage(1);
      setVideosError(null);
    }
  }, [open, channel, loadSyncStatus, loadVideos]);

  // Sync channel videos
  const handleSync = async () => {
    if (!channel || syncing) return;

    setSyncing(true);
    try {
      await client.syncYouTubeChannelVideos(channel.channel_id);
      notifySuccess(t("subscriptions.channelSyncSuccess"));
      // Reload after a short delay
      setTimeout(() => {
        loadSyncStatus();
        loadVideos(1, false);
      }, 3000);
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : t("subscriptions.channelSyncFailed");
      notifyError(message);
    } finally {
      setSyncing(false);
    }
  };

  // Load more videos
  const handleLoadMore = () => {
    loadVideos(videosPage + 1, true);
  };

  const hasMore = videos.length < videosTotal;

  if (!channel) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={channel.channel_thumbnail || undefined} />
              <AvatarFallback>
                {channel.channel_title.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{channel.channel_title}</div>
              <div
                className="text-sm font-normal"
                style={{ color: "var(--app-text-muted)" }}
              >
                {syncStatusLoading ? (
                  t("common.loading")
                ) : syncStatus ? (
                  <>
                    {t("subscriptions.channelVideoCount", { count: syncStatus.video_count })}
                    {syncStatus.last_synced_at && (
                      <>
                        {" · "}
                        {t("subscriptions.channelLastSynced")}{" "}
                        {formatDistanceToNow(new Date(syncStatus.last_synced_at), {
                          addSuffix: true,
                          locale: dateLocale,
                        })}
                      </>
                    )}
                  </>
                ) : (
                  t("subscriptions.channelNotSynced")
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(
                    `https://www.youtube.com/channel/${channel.channel_id}`,
                    "_blank"
                  )
                }
              >
                <ExternalLink className="w-4 h-4 mr-1.5" />
                YouTube
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSync}
                disabled={syncing}
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? t("subscriptions.channelSyncing") : t("subscriptions.channelSync")}
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Channel description */}
        {channel.channel_description && (
          <p
            className="text-sm line-clamp-2 px-1"
            style={{ color: "var(--app-text-muted)" }}
          >
            {channel.channel_description}
          </p>
        )}

        {/* Videos grid */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          {videosError ? (
            <div className="text-center py-12">
              <p className="text-sm" style={{ color: "var(--app-danger)" }}>
                {videosError}
              </p>
            </div>
          ) : videos.length === 0 && !videosLoading ? (
            <div className="text-center py-12">
              <VideoIcon
                className="w-12 h-12 mx-auto mb-3"
                style={{ color: "var(--app-text-muted)" }}
              />
              <p className="text-sm" style={{ color: "var(--app-text-muted)" }}>
                {t("subscriptions.videoEmpty")}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--app-text-muted)" }}>
                {t("subscriptions.videoEmptyDesc")}
              </p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={handleSync}>
                <RefreshCw className="w-4 h-4 mr-1.5" />
                {t("subscriptions.channelSync")}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {videos.map((video) => (
                  <VideoCard
                    key={video.video_id}
                    video={video}
                    channelThumbnail={channel.channel_thumbnail}
                    channelTitle={channel.channel_title}
                    showChannel={false}
                  />
                ))}
              </div>

              {/* Loading indicator */}
              {videosLoading && (
                <div className="text-center py-4">
                  <p className="text-sm" style={{ color: "var(--app-text-muted)" }}>
                    {t("subscriptions.videoLoading")}
                  </p>
                </div>
              )}

              {/* Load more button */}
              {hasMore && !videosLoading && (
                <div className="text-center py-4">
                  <Button variant="ghost" size="sm" onClick={handleLoadMore}>
                    {t("subscriptions.loadMore")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
