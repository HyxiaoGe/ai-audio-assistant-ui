"use client";

import { useState } from "react";
import { MoreVertical, Star, RefreshCw, EyeOff, Eye } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n-context";
import { useAPIClient } from "@/lib/use-api-client";
import { notifySuccess, notifyError } from "@/lib/notify";
import {
  ApiError,
  YouTubeSubscriptionItem,
  YouTubeSubscriptionSettingsUpdateRequest,
} from "@/types/api";

interface ChannelActionMenuProps {
  channel: YouTubeSubscriptionItem;
  onUpdate: (channelId: string, settings: YouTubeSubscriptionSettingsUpdateRequest) => void;
}

export default function ChannelActionMenu({
  channel,
  onUpdate,
}: ChannelActionMenuProps) {
  const { t } = useI18n();
  const client = useAPIClient();
  const [loading, setLoading] = useState(false);

  const handleUpdateSettings = async (
    settings: YouTubeSubscriptionSettingsUpdateRequest
  ) => {
    if (loading) return;

    setLoading(true);
    try {
      await client.updateYouTubeSubscriptionSettings(channel.channel_id, settings);

      // Show success message based on what was updated
      if (settings.is_starred !== undefined) {
        notifySuccess(
          settings.is_starred
            ? t("subscriptions.starSuccess")
            : t("subscriptions.unstarSuccess")
        );
      } else if (settings.auto_transcribe !== undefined) {
        notifySuccess(
          settings.auto_transcribe
            ? t("subscriptions.autoTranscribeEnabled")
            : t("subscriptions.autoTranscribeDisabled")
        );
      } else if (settings.is_hidden !== undefined) {
        notifySuccess(
          settings.is_hidden
            ? t("subscriptions.hideSuccess")
            : t("subscriptions.showSuccess")
        );
      }

      // Notify parent to update local state
      onUpdate(channel.channel_id, settings);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : t("subscriptions.updateSettingsFailed");
      notifyError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStar = () => {
    handleUpdateSettings({ is_starred: !channel.is_starred });
  };

  const handleToggleAutoTranscribe = () => {
    handleUpdateSettings({ auto_transcribe: !channel.auto_transcribe });
  };

  const handleToggleHidden = () => {
    handleUpdateSettings({ is_hidden: !channel.is_hidden });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
          disabled={loading}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={handleToggleStar} disabled={loading}>
          <Star
            className={`h-4 w-4 mr-2 ${
              channel.is_starred ? "fill-yellow-400 text-yellow-400" : ""
            }`}
          />
          {channel.is_starred
            ? t("subscriptions.actionUnstar")
            : t("subscriptions.actionStar")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleToggleAutoTranscribe} disabled={loading}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${
              channel.auto_transcribe ? "text-green-500" : ""
            }`}
          />
          {channel.auto_transcribe
            ? t("subscriptions.actionDisableAutoTranscribe")
            : t("subscriptions.actionEnableAutoTranscribe")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleToggleHidden} disabled={loading}>
          {channel.is_hidden ? (
            <>
              <Eye className="h-4 w-4 mr-2" />
              {t("subscriptions.actionShow")}
            </>
          ) : (
            <>
              <EyeOff className="h-4 w-4 mr-2" />
              {t("subscriptions.actionHide")}
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
