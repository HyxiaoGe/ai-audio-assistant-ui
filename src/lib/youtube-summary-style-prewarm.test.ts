import { describe, expect, it } from "vitest"
import { selectSummaryStylePrewarmVideoIds } from "./youtube-summary-style-prewarm"
import type { YouTubeVideoItem } from "@/types/api"

const video = (overrides: Partial<YouTubeVideoItem>): YouTubeVideoItem => ({
  video_id: "video-1",
  channel_id: "channel-1",
  title: "Video",
  published_at: "2026-05-23T00:00:00Z",
  transcribed: false,
  ...overrides,
})

describe("selectSummaryStylePrewarmVideoIds", () => {
  it("selects only untranscribed videos that have not already been requested", () => {
    const alreadyRequested = new Set(["video-2"])

    const result = selectSummaryStylePrewarmVideoIds(
      [
        video({ video_id: "video-1" }),
        video({ video_id: "video-2" }),
        video({ video_id: "video-3", transcribed: true }),
        video({ video_id: "video-1" }),
        video({ video_id: "video-4" }),
      ],
      alreadyRequested,
      2
    )

    expect(result).toEqual(["video-1", "video-4"])
  })
})
