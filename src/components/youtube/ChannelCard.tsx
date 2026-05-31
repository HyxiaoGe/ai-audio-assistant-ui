"use client";

import { Star, RefreshCw } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ChannelActionMenu from "@/components/youtube/ChannelActionMenu";
import { useI18n } from "@/lib/i18n-context";
import type {
  YouTubeSubscriptionItem,
  YouTubeSubscriptionSettingsUpdateRequest,
} from "@/types/api";

interface ChannelCardProps {
  channel: YouTubeSubscriptionItem;
  isSelected: boolean;
  onSelect: (channel: YouTubeSubscriptionItem) => void;
  onSettingsUpdate: (
    channelId: string,
    settings: YouTubeSubscriptionSettingsUpdateRequest
  ) => void;
}

/**
 * 订阅频道卡片。
 *
 * 无障碍：选择动作使用原生 <button>（Enter/Space 原生可达），频道操作菜单作为
 * 同级元素绝对定位于角落，而非嵌套进选择按钮，避免 button-in-button 反模式。
 */
export function ChannelCard({
  channel,
  isSelected,
  onSelect,
  onSettingsUpdate,
}: ChannelCardProps) {
  const { t } = useI18n();

  return (
    <div
      className={`relative flex-shrink-0 w-[140px] rounded-xl border transition-all hover:scale-105 hover:shadow-md group ${
        isSelected ? "ring-2 ring-[var(--app-primary)]" : ""
      } ${channel.is_hidden ? "opacity-50" : ""}`}
      style={{
        borderColor: "var(--app-glass-border)",
        background: "var(--app-glass-bg)",
      }}
    >
      {/* 操作菜单与状态指示：作为选择按钮的同级，覆盖在右上角 */}
      <div className="absolute top-1 right-1 z-10 flex items-center gap-1">
        {channel.is_starred && (
          <Star
            className="w-3 h-3 fill-yellow-400 text-yellow-400"
            aria-hidden="true"
          />
        )}
        <ChannelActionMenu channel={channel} onUpdate={onSettingsUpdate} />
      </div>

      <button
        type="button"
        onClick={() => onSelect(channel)}
        aria-label={channel.channel_title}
        className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-0 bg-transparent p-3 text-center"
      >
        <Avatar className="w-12 h-12">
          <AvatarImage src={channel.channel_thumbnail || undefined} alt="" />
          <AvatarFallback className="text-lg">
            {channel.channel_title.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span
          className="text-sm font-medium w-full truncate"
          style={{ color: "var(--app-text)" }}
          title={channel.channel_title}
        >
          {channel.channel_title}
        </span>
        {channel.auto_transcribe && (
          <span
            className="text-xs flex items-center gap-1"
            style={{ color: "var(--app-success)" }}
          >
            <RefreshCw className="w-3 h-3" aria-hidden="true" />
            {t("subscriptions.autoTranscribe")}
          </span>
        )}
      </button>
    </div>
  );
}
