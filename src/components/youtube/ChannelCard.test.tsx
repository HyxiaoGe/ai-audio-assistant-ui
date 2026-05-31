import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ChannelCard } from "./ChannelCard";
import type { YouTubeSubscriptionItem } from "@/types/api";

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

// 隔离 ChannelActionMenu（它依赖 api-client / notify），用一个可识别的占位按钮替代。
vi.mock("@/components/youtube/ChannelActionMenu", () => ({
  default: () => (
    <button type="button" aria-label="menu">
      menu
    </button>
  ),
}));

const channel = {
  channel_id: "c1",
  channel_title: "My Channel",
  channel_thumbnail: null,
  is_starred: false,
  is_hidden: false,
  auto_transcribe: false,
} as unknown as YouTubeSubscriptionItem;

describe("ChannelCard a11y", () => {
  it("exposes the channel as a button named by its title", () => {
    render(
      <ChannelCard
        channel={channel}
        isSelected={false}
        onSelect={vi.fn()}
        onSettingsUpdate={vi.fn()}
      />
    );
    const card = screen.getByRole("button", { name: "My Channel" });
    expect(card.tagName).toBe("BUTTON");
  });

  it("calls onSelect when the channel button is activated", () => {
    const onSelect = vi.fn();
    render(
      <ChannelCard
        channel={channel}
        isSelected={false}
        onSelect={onSelect}
        onSettingsUpdate={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "My Channel" }));
    expect(onSelect).toHaveBeenCalledWith(channel);
  });

  it("keeps the action menu as a sibling, not nested inside the select button", () => {
    render(
      <ChannelCard
        channel={channel}
        isSelected={false}
        onSelect={vi.fn()}
        onSettingsUpdate={vi.fn()}
      />
    );
    const card = screen.getByRole("button", { name: "My Channel" });
    // 选择按钮内部不应再嵌套其它按钮（避免 button-in-button 反模式）。
    expect(within(card).queryByRole("button")).toBeNull();
    // 操作菜单仍然存在，但在选择按钮之外。
    expect(screen.getByRole("button", { name: "menu" })).toBeInTheDocument();
  });
});
