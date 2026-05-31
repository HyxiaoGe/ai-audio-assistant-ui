import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import ChannelActionMenu from "./ChannelActionMenu"
import type { YouTubeSubscriptionItem } from "@/types/api"

// audit a11y #27：DropdownMenu 触发器（size="icon"）只有 MoreVertical 图标，
// 无 aria-label / sr-only 文案，读屏/键盘用户得到无名按钮。
vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}))
vi.mock("@/lib/use-api-client", () => ({
  useAPIClient: () => ({}),
}))
vi.mock("@/lib/notify", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}))

const channel = {
  channel_id: "c1",
  channel_title: "Chan",
} as unknown as YouTubeSubscriptionItem

describe("ChannelActionMenu a11y", () => {
  it("names the actions menu trigger button", () => {
    render(<ChannelActionMenu channel={channel} onUpdate={vi.fn()} />)
    expect(
      screen.getByRole("button", { name: "subscriptions.channelActions" })
    ).toBeInTheDocument()
  })
})
