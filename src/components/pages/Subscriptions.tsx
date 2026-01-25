"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ReadonlyURLSearchParams } from "next/navigation";
import {
  Youtube,
  RefreshCw,
  Link2,
  Unlink,
  CheckCircle2,
  AlertCircle,
  Search,
  X,
  Video as VideoIcon,
  Star,
} from "lucide-react";
import { useDateFormatter } from "@/lib/use-date-formatter";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import EmptyState from "@/components/common/EmptyState";
import VideoCard from "@/components/youtube/VideoCard";
import ChannelActionMenu from "@/components/youtube/ChannelActionMenu";
import NewTaskModal from "@/components/task/NewTaskModal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n-context";
import { useAPIClient } from "@/lib/use-api-client";
import { notifySuccess, notifyError } from "@/lib/notify";
import {
  ApiError,
  YouTubeConnectionStatus,
  YouTubeSubscriptionItem,
  YouTubeSubscriptionSettingsUpdateRequest,
  YouTubeSyncOverview,
  YouTubeVideoItem,
} from "@/types/api";

interface SubscriptionsProps {
  isAuthenticated: boolean;
  onOpenLogin: () => void;
  language?: "zh" | "en";
  onToggleLanguage?: () => void;
  onToggleTheme?: () => void;
  searchParams: ReadonlyURLSearchParams;
}

export default function Subscriptions({
  isAuthenticated,
  onOpenLogin,
  language = "zh",
  onToggleLanguage,
  onToggleTheme,
  searchParams,
}: SubscriptionsProps) {
  const { t, locale } = useI18n();
  const client = useAPIClient();
  const router = useRouter();
  const { formatRelativeTime } = useDateFormatter();

  // Tab state
  const [activeTab, setActiveTab] = useState<"latest" | "starred" | "channels">("latest");

  // Ref for scrolling to channel videos section
  const channelVideosRef = useRef<HTMLDivElement>(null);

  // Ref for sync polling interval
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Refs to store latest function references for interval callbacks
  const loadSyncOverviewRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const loadLatestVideosRef = useRef<(page?: number, append?: boolean, force?: boolean) => Promise<void>>(() => Promise.resolve());
  const loadSubscriptionsRef = useRef<(page?: number, append?: boolean, force?: boolean) => Promise<void>>(() => Promise.resolve());
  const loadChannelVideosRef = useRef<(channelId: string, page?: number, append?: boolean) => Promise<void>>(() => Promise.resolve());

  // Connection state
  const [status, setStatus] = useState<YouTubeConnectionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);

  // Subscriptions list state
  const [subscriptions, setSubscriptions] = useState<YouTubeSubscriptionItem[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [subsTotal, setSubsTotal] = useState(0);
  const [subsPage, setSubsPage] = useState(1);
  const [subsError, setSubsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Latest videos state
  const [latestVideos, setLatestVideos] = useState<YouTubeVideoItem[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [videosTotal, setVideosTotal] = useState(0);
  const [videosPage, setVideosPage] = useState(1);
  const [videosError, setVideosError] = useState<string | null>(null);

  // Selected channel (inline view instead of dialog)
  const [selectedChannel, setSelectedChannel] = useState<YouTubeSubscriptionItem | null>(null);
  const [channelVideos, setChannelVideos] = useState<YouTubeVideoItem[]>([]);
  const [channelVideosLoading, setChannelVideosLoading] = useState(false);
  const [channelVideosTotal, setChannelVideosTotal] = useState(0);
  const [channelVideosPage, setChannelVideosPage] = useState(1);
  const [channelVideosError, setChannelVideosError] = useState<string | null>(null);
  const [channelSyncing, setChannelSyncing] = useState(false);

  // Sync overview
  const [syncOverview, setSyncOverview] = useState<YouTubeSyncOverview | null>(null);

  // Channel filter state
  const [showHidden, setShowHidden] = useState(false);
  const [starredOnly, setStarredOnly] = useState(false);

  // Starred videos state
  const [starredVideos, setStarredVideos] = useState<YouTubeVideoItem[]>([]);
  const [starredVideosLoading, setStarredVideosLoading] = useState(false);
  const [starredVideosTotal, setStarredVideosTotal] = useState(0);
  const [starredVideosPage, setStarredVideosPage] = useState(1);
  const [starredVideosError, setStarredVideosError] = useState<string | null>(null);
  const [starredVideosStale, setStarredVideosStale] = useState(false);

  // New task modal for transcription
  const [newTaskModalOpen, setNewTaskModalOpen] = useState(false);
  const [transcribeVideoUrl, setTranscribeVideoUrl] = useState<string | undefined>(undefined);

  // Filter subscriptions by search query and visibility settings
  const filteredSubscriptions = useMemo(() => {
    let filtered = subscriptions;

    // Filter by hidden status
    if (showHidden) {
      // Show only hidden channels
      filtered = filtered.filter((sub) => sub.is_hidden);
    } else {
      // Show only non-hidden channels
      filtered = filtered.filter((sub) => !sub.is_hidden);
    }

    // Filter by starred status
    if (starredOnly) {
      filtered = filtered.filter((sub) => sub.is_starred);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (sub) =>
          sub.channel_title.toLowerCase().includes(query) ||
          sub.channel_description?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [subscriptions, searchQuery, showHidden, starredOnly]);
  const PAGE_SIZE = 20;
  const VIDEOS_PAGE_SIZE = 12;

  // Load YouTube connection status
  const loadStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setStatusLoading(false);
      return;
    }

    setStatusLoading(true);
    try {
      const result = await client.getYouTubeStatus();
      setStatus(result);
    } catch (error) {
      // Not connected is expected
      if (error instanceof ApiError && error.code === 51900) {
        setStatus({ connected: false, subscription_count: 0 });
      } else {
        console.error("Failed to load YouTube status:", error);
        setStatus({ connected: false, subscription_count: 0 });
      }
    } finally {
      setStatusLoading(false);
    }
  }, [client, isAuthenticated]);

  // Load sync overview
  const loadSyncOverview = useCallback(async () => {
    try {
      const result = await client.getYouTubeSyncOverview();
      setSyncOverview(result);
    } catch {
      // Ignore errors, sync overview is optional
    }
  }, [client]);

  // Load subscriptions list
  const loadSubscriptions = useCallback(
    async (page: number = 1, append: boolean = false, force: boolean = false) => {
      if (!force && (!isAuthenticated || !status?.connected)) return;

      setSubsLoading(true);
      setSubsError(null);
      try {
        // Always fetch all subscriptions (including hidden) for client-side filtering
        const result = await client.getYouTubeSubscriptions({
          page,
          page_size: PAGE_SIZE,
          show_hidden: true,
        });
        if (append) {
          setSubscriptions((prev) => [...prev, ...result.items]);
        } else {
          setSubscriptions(result.items);
        }
        setSubsTotal(result.total);
        setSubsPage(page);
      } catch (error) {
        const message =
          error instanceof ApiError
            ? error.message
            : t("subscriptions.loadFailed");
        setSubsError(message);
      } finally {
        setSubsLoading(false);
      }
    },
    [client, isAuthenticated, status?.connected, t]
  );

  // Load latest videos
  const loadLatestVideos = useCallback(
    async (page: number = 1, append: boolean = false, force: boolean = false) => {
      if (!force && (!isAuthenticated || !status?.connected)) return;

      setVideosLoading(true);
      setVideosError(null);
      try {
        const result = await client.getYouTubeLatestVideos({
          page,
          page_size: VIDEOS_PAGE_SIZE,
        });
        if (append) {
          setLatestVideos((prev) => [...prev, ...result.items]);
        } else {
          setLatestVideos(result.items);
        }
        setVideosTotal(result.total);
        setVideosPage(page);
      } catch (error) {
        const message =
          error instanceof ApiError
            ? error.message
            : t("subscriptions.loadFailed");
        setVideosError(message);
      } finally {
        setVideosLoading(false);
      }
    },
    [client, isAuthenticated, status?.connected, t]
  );

  // Load starred videos
  const loadStarredVideos = useCallback(
    async (page: number = 1, append: boolean = false, force: boolean = false) => {
      if (!force && (!isAuthenticated || !status?.connected)) return;

      setStarredVideosLoading(true);
      setStarredVideosError(null);
      try {
        const result = await client.getYouTubeStarredVideos({
          page,
          page_size: VIDEOS_PAGE_SIZE,
        });
        if (append) {
          setStarredVideos((prev) => [...prev, ...result.items]);
        } else {
          setStarredVideos(result.items);
        }
        setStarredVideosTotal(result.total);
        setStarredVideosPage(page);
      } catch (error) {
        const message =
          error instanceof ApiError
            ? error.message
            : t("subscriptions.loadFailed");
        setStarredVideosError(message);
      } finally {
        setStarredVideosLoading(false);
      }
    },
    [client, isAuthenticated, status?.connected, t]
  );

  // Poll task status until complete
  const pollTaskStatus = useCallback(
    async (taskId: string, onComplete: () => void) => {
      const maxAttempts = 120;
      let attempts = 0;

      const poll = async () => {
        attempts++;
        try {
          const result = await client.getYouTubeTaskStatus(taskId);

          if (result.status === "success") {
            onComplete();
            return;
          } else if (result.status === "failure" || result.status === "revoked") {
            notifyError(result.error || t("subscriptions.syncFailed"));
            onComplete();
            return;
          } else if (attempts < maxAttempts) {
            setTimeout(poll, 1000);
          } else {
            onComplete();
          }
        } catch {
          if (attempts < maxAttempts) {
            setTimeout(poll, 1000);
          } else {
            onComplete();
          }
        }
      };

      setTimeout(poll, 500);
    },
    [client, t]
  );

  // Keep refs updated with latest function references
  useEffect(() => {
    loadSyncOverviewRef.current = loadSyncOverview;
  }, [loadSyncOverview]);

  useEffect(() => {
    loadLatestVideosRef.current = loadLatestVideos;
  }, [loadLatestVideos]);

  useEffect(() => {
    loadSubscriptionsRef.current = loadSubscriptions;
  }, [loadSubscriptions]);

  // Real-time sync progress refresh using interval
  // Start when syncing becomes true, stop when fully_synced becomes true
  useEffect(() => {
    if (!syncing) {
      return;
    }

    const intervalId = setInterval(async () => {
      // Refresh sync overview
      try {
        const overview = await client.getYouTubeSyncOverview();
        setSyncOverview(overview);

        // If fully synced, stop the interval and set syncing to false
        if (overview.fully_synced) {
          clearInterval(intervalId);
          setSyncing(false);
          // Final refresh of all data
          loadLatestVideosRef.current(1, false, true);
          loadSubscriptionsRef.current(1, false, true);
          loadStatus();
          return;
        }
      } catch {
        // Ignore errors, will retry on next tick
      }

      // Refresh videos and subscriptions
      loadLatestVideosRef.current(1, false, true);
      loadSubscriptionsRef.current(1, false, true);
    }, 3000);

    syncIntervalRef.current = intervalId;

    return () => {
      clearInterval(intervalId);
      syncIntervalRef.current = null;
    };
  }, [syncing, client, loadStatus]);


  // Load selected channel videos
  const loadChannelVideos = useCallback(
    async (channelId: string, page: number = 1, append: boolean = false) => {
      setChannelVideosLoading(true);
      setChannelVideosError(null);
      try {
        const result = await client.getYouTubeChannelVideos(channelId, {
          page,
          page_size: VIDEOS_PAGE_SIZE,
        });
        if (append) {
          setChannelVideos((prev) => [...prev, ...result.items]);
        } else {
          setChannelVideos(result.items);
        }
        setChannelVideosTotal(result.total);
        setChannelVideosPage(page);
      } catch (error) {
        const message =
          error instanceof ApiError
            ? error.message
            : t("subscriptions.loadFailed");
        setChannelVideosError(message);
      } finally {
        setChannelVideosLoading(false);
      }
    },
    [client, t]
  );

  // Keep loadChannelVideos ref updated
  useEffect(() => {
    loadChannelVideosRef.current = loadChannelVideos;
  }, [loadChannelVideos]);

  // Real-time channel sync progress refresh
  useEffect(() => {
    if (!channelSyncing || !selectedChannel) {
      if (channelSyncIntervalRef.current) {
        clearInterval(channelSyncIntervalRef.current);
        channelSyncIntervalRef.current = null;
      }
      return;
    }

    const channelId = selectedChannel.channel_id;
    // Start interval to refresh channel videos every 3 seconds
    channelSyncIntervalRef.current = setInterval(() => {
      loadSyncOverviewRef.current();
      loadChannelVideosRef.current(channelId, 1, false);
    }, 3000);

    return () => {
      if (channelSyncIntervalRef.current) {
        clearInterval(channelSyncIntervalRef.current);
        channelSyncIntervalRef.current = null;
      }
    };
  }, [channelSyncing, selectedChannel]); // Only depend on state, use refs for functions

  // Sync selected channel videos
  const handleSyncChannelVideos = async () => {
    if (!selectedChannel || channelSyncing) return;

    const channelId = selectedChannel.channel_id;
    setChannelSyncing(true);
    try {
      const result = await client.syncYouTubeChannelVideos(channelId);
      notifySuccess(t("subscriptions.channelSyncSuccess"));
      // Poll for task completion
      pollTaskStatus(result.task_id, () => {
        loadChannelVideos(channelId, 1, false);
        loadSyncOverview();
        setChannelSyncing(false);
      });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : t("subscriptions.channelSyncFailed");
      notifyError(message);
      setChannelSyncing(false);
    }
  };

  // Handle OAuth callback via URL params
  useEffect(() => {
    const youtubeParam = searchParams.get("youtube");
    const reason = searchParams.get("reason");
    const taskId = searchParams.get("task_id");

    if (youtubeParam === "connected") {
      notifySuccess(t("subscriptions.connectSuccess"));
      router.replace("/subscriptions", { scroll: false });

      // Start syncing - the interval will handle real-time updates
      // and will stop when fully_synced becomes true
      setSyncing(true);
      setVideosLoading(true);

      // If no task_id from backend, trigger sync manually
      if (!taskId) {
        client.syncYouTubeSubscriptions().catch(() => {
          loadStatus();
          setSyncing(false);
          setVideosLoading(false);
        });
      }
    } else if (youtubeParam === "error") {
      const errorMessage = reason || t("subscriptions.connectFailed");
      notifyError(errorMessage);
      router.replace("/subscriptions", { scroll: false });
    }
  }, [searchParams, router, t, loadStatus, loadSyncOverview, loadSubscriptions, loadLatestVideos, pollTaskStatus, client]);

  // Initial load
  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Load data when connected
  useEffect(() => {
    if (status?.connected) {
      loadSyncOverview();
      loadSubscriptions(1, false);
      loadLatestVideos(1, false);
      loadStarredVideos(1, false);
    }
  }, [status?.connected, loadSyncOverview, loadSubscriptions, loadLatestVideos, loadStarredVideos]);

  // Connect to YouTube
  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { auth_url } = await client.getYouTubeAuthUrl();
      window.location.href = auth_url;
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : t("subscriptions.connectFailed");
      notifyError(message);
      setConnecting(false);
    }
  };

  // Disconnect YouTube
  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await client.disconnectYouTube();
      setStatus({ connected: false, subscription_count: 0 });
      setSubscriptions([]);
      setSubsTotal(0);
      setLatestVideos([]);
      setVideosTotal(0);
      notifySuccess(t("subscriptions.disconnectSuccess"));
      setDisconnectDialogOpen(false);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : t("subscriptions.disconnectFailed");
      notifyError(message);
    } finally {
      setDisconnecting(false);
    }
  };

  // Sync subscriptions
  const handleSync = async () => {
    setSyncing(true);
    setVideosLoading(true);
    try {
      await client.syncYouTubeSubscriptions();
      notifySuccess(t("subscriptions.syncSuccess"));
      // The interval will handle real-time updates and stop when fully_synced
    } catch (error) {
      if (error instanceof ApiError && error.code === 51902) {
        notifyError(t("subscriptions.tokenExpired"));
      } else {
        const message =
          error instanceof ApiError
            ? error.message
            : t("subscriptions.syncFailed");
        notifyError(message);
      }
      setSyncing(false);
      setVideosLoading(false);
    }
  };

  // Load more subscriptions
  const handleLoadMoreSubs = () => {
    loadSubscriptions(subsPage + 1, true);
  };

  // Load more videos
  const handleLoadMoreVideos = () => {
    loadLatestVideos(videosPage + 1, true);
  };

  // Select channel to view its videos
  const handleChannelClick = (channel: YouTubeSubscriptionItem) => {
    // If clicking the same channel, just scroll to videos
    if (selectedChannel?.channel_id === channel.channel_id) {
      channelVideosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    setSelectedChannel(channel);
    setChannelVideos([]);
    setChannelVideosTotal(0);
    setChannelVideosPage(1);
    setChannelVideosError(null);
    loadChannelVideos(channel.channel_id, 1, false);

    // Scroll to channel videos section after state update
    setTimeout(() => {
      channelVideosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  // Go back to channel list
  const handleBackToChannels = () => {
    setSelectedChannel(null);
    setChannelVideos([]);
    setChannelVideosTotal(0);
    setChannelVideosPage(1);
    setChannelVideosError(null);
  };

  // Load more channel videos
  const handleLoadMoreChannelVideos = () => {
    if (selectedChannel) {
      loadChannelVideos(selectedChannel.channel_id, channelVideosPage + 1, true);
    }
  };

  const hasMoreSubs = subscriptions.length < subsTotal;
  const hasMoreVideos = latestVideos.length < videosTotal;
  const hasMoreChannelVideos = channelVideos.length < channelVideosTotal;

  // Handle transcribe action - opens modal with pre-filled URL
  const handleTranscribe = (videoUrl: string) => {
    setTranscribeVideoUrl(videoUrl);
    setNewTaskModalOpen(true);
  };

  // Handle modal close
  const handleCloseNewTaskModal = () => {
    setNewTaskModalOpen(false);
    setTranscribeVideoUrl(undefined);
  };

  // Find channel info for a video
  const getChannelInfo = (channelId: string) => {
    const channel = subscriptions.find((s) => s.channel_id === channelId);
    return {
      thumbnail: channel?.channel_thumbnail,
      title: channel?.channel_title,
    };
  };

  // Handle channel settings update from ChannelActionMenu
  const handleChannelSettingsUpdate = (
    channelId: string,
    settings: YouTubeSubscriptionSettingsUpdateRequest
  ) => {
    // Update local state optimistically
    setSubscriptions((prev) =>
      prev.map((sub) =>
        sub.channel_id === channelId
          ? {
              ...sub,
              ...(settings.is_starred !== undefined && { is_starred: settings.is_starred }),
              ...(settings.auto_transcribe !== undefined && { auto_transcribe: settings.auto_transcribe }),
              ...(settings.is_hidden !== undefined && { is_hidden: settings.is_hidden }),
            }
          : sub
      )
    );

    // If a channel was hidden, also update selectedChannel if it's the same
    if (settings.is_hidden && selectedChannel?.channel_id === channelId) {
      setSelectedChannel(null);
      setChannelVideos([]);
    }

    // If starred status changed, mark starred videos as stale
    if (settings.is_starred !== undefined) {
      setStarredVideosStale(true);
    }
  };

  // Load more starred videos
  const handleLoadMoreStarredVideos = () => {
    loadStarredVideos(starredVideosPage + 1, true);
  };

  const hasMoreStarredVideos = starredVideos.length < starredVideosTotal;

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--app-bg)" }}>
      <Header
        isAuthenticated={isAuthenticated}
        onOpenLogin={onOpenLogin}
        language={language}
        onToggleLanguage={onToggleLanguage}
        onToggleTheme={onToggleTheme}
      />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Page header */}
            <div>
              <h1
                className="text-2xl font-bold"
                style={{ color: "var(--app-text)" }}
              >
                {t("subscriptions.pageTitle")}
              </h1>
              <p
                className="text-sm mt-1"
                style={{ color: "var(--app-text-muted)" }}
              >
                {t("subscriptions.pageSubtitle")}
              </p>
            </div>

            {/* Login required state */}
            {!isAuthenticated ? (
              <EmptyState
                icon="📺"
                title={t("subscriptions.loginRequiredTitle")}
                description={t("subscriptions.loginRequiredDesc")}
                action={{
                  label: t("auth.login"),
                  onClick: onOpenLogin,
                }}
              />
            ) : (
              <>
                {/* Connection status card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Youtube className="w-5 h-5 text-red-500" />
                      {t("subscriptions.connectTitle")}
                    </CardTitle>
                    <CardDescription>
                      {t("subscriptions.connectDesc")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {statusLoading ? (
                      <p
                        className="text-sm"
                        style={{ color: "var(--app-text-muted)" }}
                      >
                        {t("common.loading")}...
                      </p>
                    ) : status?.connected ? (
                      // Connected state
                      <div className="space-y-4">
                        <div
                          className="rounded-xl border p-4 space-y-3"
                          style={{
                            borderColor: "var(--app-glass-border)",
                            background: "var(--app-glass-bg)",
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[var(--app-success)]" />
                              <span
                                className="text-sm font-medium"
                                style={{ color: "var(--app-success)" }}
                              >
                                {t("subscriptions.connected")}
                              </span>
                            </div>
                            {status.subscription_count != null && (
                              <span
                                className="text-sm"
                                style={{ color: "var(--app-text-muted)" }}
                              >
                                {t("subscriptions.subscriptionCount", {
                                  count: status.subscription_count,
                                })}
                              </span>
                            )}
                          </div>

                          {status.last_synced_at && (
                            <p
                              className="text-xs"
                              style={{ color: "var(--app-text-muted)" }}
                            >
                              {t("subscriptions.lastSynced")}:{" "}
                              {formatRelativeTime(status.last_synced_at)}
                            </p>
                          )}

                          {/* Sync overview */}
                          {syncOverview && (
                            <div className="flex items-center gap-2 pt-1">
                              {syncOverview.fully_synced ? (
                                <span
                                  className="text-xs flex items-center gap-1"
                                  style={{ color: "var(--app-success)" }}
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  {t("subscriptions.syncComplete")}
                                </span>
                              ) : (
                                <span
                                  className="text-xs flex items-center gap-1"
                                  style={{ color: syncing ? "var(--app-primary)" : "var(--app-text-muted)" }}
                                >
                                  {syncing && <RefreshCw className="w-3 h-3 animate-spin" />}
                                  {t("subscriptions.syncOverview", {
                                    synced: syncOverview.synced_subscriptions,
                                    total: syncOverview.total_subscriptions,
                                    videos: syncOverview.total_videos,
                                  })}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleSync}
                            disabled={syncing}
                          >
                            <RefreshCw
                              className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`}
                            />
                            {syncing
                              ? t("subscriptions.syncing")
                              : t("subscriptions.syncButton")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDisconnectDialogOpen(true)}
                            disabled={disconnecting}
                            className="text-[var(--app-danger)] hover:text-[var(--app-danger)] hover:bg-[var(--app-danger)]/10"
                          >
                            <Unlink className="w-4 h-4 mr-2" />
                            {t("subscriptions.disconnectButton")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // Not connected state
                      <div className="space-y-4">
                        <div
                          className="rounded-xl border p-4 flex items-center gap-3"
                          style={{
                            borderColor: "var(--app-glass-border)",
                            background: "var(--app-glass-bg)",
                          }}
                        >
                          <AlertCircle
                            className="w-5 h-5"
                            style={{ color: "var(--app-text-muted)" }}
                          />
                          <span
                            className="text-sm"
                            style={{ color: "var(--app-text-muted)" }}
                          >
                            {t("subscriptions.notConnected")}
                          </span>
                        </div>
                        <Button
                          onClick={handleConnect}
                          disabled={connecting}
                          className="gap-2"
                        >
                          <Link2 className="w-4 h-4" />
                          {connecting
                            ? t("subscriptions.connecting")
                            : t("subscriptions.connectButton")}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Content tabs */}
                {status?.connected && (
                  <Tabs
                    value={activeTab}
                    onValueChange={(value) => {
                      const newTab = value as "latest" | "starred" | "channels";
                      setActiveTab(newTab);
                      // Reload starred videos if switching to starred tab and data is stale
                      if (newTab === "starred" && starredVideosStale) {
                        setStarredVideosStale(false);
                        loadStarredVideos(1, false);
                      }
                    }}
                  >
                    <TabsList className="mb-4">
                      <TabsTrigger value="latest">
                        {t("subscriptions.tabLatestVideos")}
                      </TabsTrigger>
                      <TabsTrigger value="starred">
                        {t("subscriptions.tabStarredVideos")}
                      </TabsTrigger>
                      <TabsTrigger value="channels">
                        {t("subscriptions.tabChannels")}
                      </TabsTrigger>
                    </TabsList>

                    {/* Latest Videos Tab */}
                    <TabsContent value="latest" className="mt-0">
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle>{t("subscriptions.tabLatestVideos")}</CardTitle>
                            {latestVideos.length > 0 && (
                              <span
                                className="text-sm"
                                style={{ color: "var(--app-text-muted)" }}
                              >
                                {videosTotal} {t("subscriptions.tabLatestVideos").toLowerCase()}
                              </span>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          {videosError ? (
                            <div className="text-center py-12">
                              <p className="text-sm" style={{ color: "var(--app-danger)" }}>
                                {videosError}
                              </p>
                            </div>
                          ) : latestVideos.length === 0 && !videosLoading ? (
                            <div className="text-center py-12">
                              <VideoIcon
                                className="w-12 h-12 mx-auto mb-3"
                                style={{ color: "var(--app-text-muted)" }}
                              />
                              <p
                                className="text-sm"
                                style={{ color: "var(--app-text-muted)" }}
                              >
                                {t("subscriptions.videoEmpty")}
                              </p>
                              <p
                                className="text-xs mt-1"
                                style={{ color: "var(--app-text-muted)" }}
                              >
                                {t("subscriptions.videoSyncHint")}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {/* Video grid */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {latestVideos.map((video) => {
                                  const channelInfo = getChannelInfo(video.channel_id);
                                  return (
                                    <VideoCard
                                      key={video.video_id}
                                      video={video}
                                      channelThumbnail={channelInfo.thumbnail}
                                      channelTitle={channelInfo.title}
                                      showChannel={true}
                                      onTranscribe={handleTranscribe}
                                    />
                                  );
                                })}
                              </div>

                              {/* Loading indicator */}
                              {videosLoading && (
                                <div className="text-center py-4">
                                  <p
                                    className="text-sm"
                                    style={{ color: "var(--app-text-muted)" }}
                                  >
                                    {t("subscriptions.videoLoading")}
                                  </p>
                                </div>
                              )}

                              {/* Load more button */}
                              {hasMoreVideos && !videosLoading && (
                                <div className="text-center pt-4">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleLoadMoreVideos}
                                  >
                                    {t("subscriptions.loadMore")}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Starred Videos Tab */}
                    <TabsContent value="starred" className="mt-0">
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle>{t("subscriptions.tabStarredVideos")}</CardTitle>
                            {starredVideos.length > 0 && (
                              <span
                                className="text-sm"
                                style={{ color: "var(--app-text-muted)" }}
                              >
                                {starredVideosTotal} {t("subscriptions.tabStarredVideos").toLowerCase()}
                              </span>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          {starredVideosError ? (
                            <div className="text-center py-12">
                              <p className="text-sm" style={{ color: "var(--app-danger)" }}>
                                {starredVideosError}
                              </p>
                            </div>
                          ) : starredVideos.length === 0 && !starredVideosLoading ? (
                            <div className="text-center py-12">
                              <Star
                                className="w-12 h-12 mx-auto mb-3"
                                style={{ color: "var(--app-text-muted)" }}
                              />
                              <p
                                className="text-sm"
                                style={{ color: "var(--app-text-muted)" }}
                              >
                                {t("subscriptions.noStarredVideos")}
                              </p>
                              <p
                                className="text-xs mt-1"
                                style={{ color: "var(--app-text-muted)" }}
                              >
                                {t("subscriptions.noStarredChannels")}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {/* Video grid */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {starredVideos.map((video) => {
                                  const channelInfo = getChannelInfo(video.channel_id);
                                  return (
                                    <VideoCard
                                      key={video.video_id}
                                      video={video}
                                      channelThumbnail={channelInfo.thumbnail}
                                      channelTitle={channelInfo.title}
                                      showChannel={true}
                                      onTranscribe={handleTranscribe}
                                    />
                                  );
                                })}
                              </div>

                              {/* Loading indicator */}
                              {starredVideosLoading && (
                                <div className="text-center py-4">
                                  <p
                                    className="text-sm"
                                    style={{ color: "var(--app-text-muted)" }}
                                  >
                                    {t("subscriptions.videoLoading")}
                                  </p>
                                </div>
                              )}

                              {/* Load more button */}
                              {hasMoreStarredVideos && !starredVideosLoading && (
                                <div className="text-center pt-4">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleLoadMoreStarredVideos}
                                  >
                                    {t("subscriptions.loadMore")}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Channels Tab */}
                    <TabsContent value="channels" className="mt-0 space-y-4">
                      {/* Channel list (horizontal scroll) */}
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle>{t("subscriptions.listTitle")}</CardTitle>
                            {subscriptions.length > 0 && (
                              <span
                                className="text-sm"
                                style={{ color: "var(--app-text-muted)" }}
                              >
                                {searchQuery
                                  ? t("subscriptions.searchResults", {
                                      count: filteredSubscriptions.length,
                                    })
                                  : t("subscriptions.subscriptionCount", {
                                      count: subscriptions.length,
                                    })}
                              </span>
                            )}
                          </div>
                          {/* Search input */}
                          {subscriptions.length > 0 && (
                            <div className="relative mt-3">
                              <Search
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                                style={{ color: "var(--app-text-muted)" }}
                              />
                              <Input
                                placeholder={t("subscriptions.searchPlaceholder")}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-9"
                                style={{
                                  background: "var(--app-glass-bg)",
                                  borderColor: "var(--app-glass-border)",
                                }}
                              />
                              {searchQuery && (
                                <button
                                  onClick={() => setSearchQuery("")}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
                                  style={{ color: "var(--app-text-muted)" }}
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          )}
                          {/* Filter buttons */}
                          {subscriptions.length > 0 && (
                            <div className="flex items-center gap-2 mt-3">
                              <Button
                                variant={!starredOnly && !showHidden ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                  setStarredOnly(false);
                                  setShowHidden(false);
                                }}
                              >
                                {t("subscriptions.filterAll")}
                              </Button>
                              <Button
                                variant={starredOnly ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                  setStarredOnly(!starredOnly);
                                  if (!starredOnly) setShowHidden(false);
                                }}
                              >
                                <Star className={`w-3 h-3 mr-1 ${starredOnly ? "fill-current" : ""}`} />
                                {t("subscriptions.filterStarred")}
                              </Button>
                              <Button
                                variant={showHidden ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                  setShowHidden(!showHidden);
                                  if (!showHidden) setStarredOnly(false);
                                }}
                              >
                                {t("subscriptions.filterShowHidden")}
                              </Button>
                            </div>
                          )}
                        </CardHeader>
                        <CardContent>
                          {subsError ? (
                            <p
                              className="text-sm text-center py-8"
                              style={{ color: "var(--app-danger)" }}
                            >
                              {subsError}
                            </p>
                          ) : subscriptions.length === 0 && !subsLoading ? (
                            <div className="text-center py-8">
                              <p
                                className="text-sm"
                                style={{ color: "var(--app-text-muted)" }}
                              >
                                {t("subscriptions.listEmpty")}
                              </p>
                              <p
                                className="text-xs mt-1"
                                style={{ color: "var(--app-text-muted)" }}
                              >
                                {t("subscriptions.listEmptyDesc")}
                              </p>
                            </div>
                          ) : filteredSubscriptions.length === 0 ? (
                            <div className="text-center py-8">
                              <p
                                className="text-sm"
                                style={{ color: "var(--app-text-muted)" }}
                              >
                                {t("subscriptions.searchEmpty")}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {/* Horizontal scrolling card grid */}
                              <ScrollArea className="w-full">
                                <div className="flex gap-3 px-1 pt-1 pb-4">
                                  {filteredSubscriptions.map((sub) => (
                                    <div
                                      key={sub.channel_id}
                                      className={`relative flex-shrink-0 w-[140px] p-3 rounded-xl border transition-all hover:scale-105 hover:shadow-md group cursor-pointer ${
                                        selectedChannel?.channel_id === sub.channel_id
                                          ? "ring-2 ring-[var(--app-primary)]"
                                          : ""
                                      } ${sub.is_hidden ? "opacity-50" : ""}`}
                                      style={{
                                        borderColor: "var(--app-glass-border)",
                                        background: "var(--app-glass-bg)",
                                      }}
                                      onClick={() => handleChannelClick(sub)}
                                    >
                                      {/* Action menu and status indicators */}
                                      <div className="absolute top-1 right-1 flex items-center gap-1">
                                        {sub.is_starred && (
                                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                        )}
                                        <ChannelActionMenu
                                          channel={sub}
                                          onUpdate={handleChannelSettingsUpdate}
                                        />
                                      </div>

                                      <div className="flex flex-col items-center text-center gap-2">
                                        <Avatar className="w-12 h-12">
                                          <AvatarImage
                                            src={sub.channel_thumbnail || undefined}
                                            alt={sub.channel_title}
                                          />
                                          <AvatarFallback className="text-lg">
                                            {sub.channel_title.charAt(0).toUpperCase()}
                                          </AvatarFallback>
                                        </Avatar>
                                        <p
                                          className="text-sm font-medium w-full truncate"
                                          style={{ color: "var(--app-text)" }}
                                          title={sub.channel_title}
                                        >
                                          {sub.channel_title}
                                        </p>
                                        {/* Auto transcribe indicator */}
                                        {sub.auto_transcribe && (
                                          <span
                                            className="text-xs flex items-center gap-1"
                                            style={{ color: "var(--app-success)" }}
                                          >
                                            <RefreshCw className="w-3 h-3" />
                                            {t("subscriptions.autoTranscribe")}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <ScrollBar orientation="horizontal" />
                              </ScrollArea>

                              {/* Load more */}
                              {hasMoreSubs && !searchQuery && (
                                <div className="text-center pt-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleLoadMoreSubs}
                                    disabled={subsLoading}
                                  >
                                    {subsLoading
                                      ? t("common.loading")
                                      : t("subscriptions.loadMore")}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Selected channel videos */}
                      {selectedChannel && (
                        <Card ref={channelVideosRef}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Avatar className="w-8 h-8">
                                  <AvatarImage
                                    src={selectedChannel.channel_thumbnail || undefined}
                                    alt={selectedChannel.channel_title}
                                  />
                                  <AvatarFallback>
                                    {selectedChannel.channel_title.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <CardTitle>{selectedChannel.channel_title}</CardTitle>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={handleSyncChannelVideos}
                                  disabled={channelSyncing}
                                >
                                  <RefreshCw
                                    className={`w-4 h-4 mr-1.5 ${channelSyncing ? "animate-spin" : ""}`}
                                  />
                                  {channelSyncing
                                    ? t("subscriptions.channelSyncing")
                                    : t("subscriptions.channelSync")}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleBackToChannels}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            {channelVideosTotal > 0 && (
                              <p
                                className="text-sm mt-1"
                                style={{ color: "var(--app-text-muted)" }}
                              >
                                {t("subscriptions.channelVideoCount", {
                                  count: channelVideosTotal,
                                })}
                              </p>
                            )}
                          </CardHeader>
                          <CardContent>
                            {channelVideosError ? (
                              <div className="text-center py-12">
                                <p className="text-sm" style={{ color: "var(--app-danger)" }}>
                                  {channelVideosError}
                                </p>
                              </div>
                            ) : channelVideos.length === 0 && !channelVideosLoading ? (
                              <div className="text-center py-12">
                                <VideoIcon
                                  className="w-12 h-12 mx-auto mb-3"
                                  style={{ color: "var(--app-text-muted)" }}
                                />
                                <p
                                  className="text-sm"
                                  style={{ color: "var(--app-text-muted)" }}
                                >
                                  {t("subscriptions.videoEmpty")}
                                </p>
                                <p
                                  className="text-xs mt-1"
                                  style={{ color: "var(--app-text-muted)" }}
                                >
                                  {t("subscriptions.videoEmptyDesc")}
                                </p>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="mt-4"
                                  onClick={handleSyncChannelVideos}
                                  disabled={channelSyncing}
                                >
                                  <RefreshCw
                                    className={`w-4 h-4 mr-1.5 ${channelSyncing ? "animate-spin" : ""}`}
                                  />
                                  {t("subscriptions.channelSync")}
                                </Button>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {/* Video grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                  {channelVideos.map((video) => (
                                    <VideoCard
                                      key={video.video_id}
                                      video={video}
                                      channelThumbnail={selectedChannel.channel_thumbnail}
                                      channelTitle={selectedChannel.channel_title}
                                      showChannel={false}
                                      onTranscribe={handleTranscribe}
                                    />
                                  ))}
                                </div>

                                {/* Loading indicator */}
                                {channelVideosLoading && (
                                  <div className="text-center py-4">
                                    <p
                                      className="text-sm"
                                      style={{ color: "var(--app-text-muted)" }}
                                    >
                                      {t("subscriptions.videoLoading")}
                                    </p>
                                  </div>
                                )}

                                {/* Load more button */}
                                {hasMoreChannelVideos && !channelVideosLoading && (
                                  <div className="text-center pt-4">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={handleLoadMoreChannelVideos}
                                    >
                                      {t("subscriptions.loadMore")}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Disconnect confirmation dialog */}
      <Dialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("subscriptions.disconnectConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("subscriptions.disconnectConfirmDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setDisconnectDialogOpen(false)}
              disabled={disconnecting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? t("common.loading") : t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New task modal for transcription */}
      <NewTaskModal
        isOpen={newTaskModalOpen}
        onClose={handleCloseNewTaskModal}
        initialVideoUrl={transcribeVideoUrl}
      />
    </div>
  );
}
