import type { YouTubeVideoItem } from "@/types/api"

export function selectSummaryStylePrewarmVideoIds(
  videos: YouTubeVideoItem[],
  alreadyRequested: ReadonlySet<string>,
  limit: number
): string[] {
  const selected: string[] = []
  const seen = new Set<string>()

  for (const video of videos) {
    const videoId = video.video_id?.trim()
    if (!videoId || video.transcribed || alreadyRequested.has(videoId) || seen.has(videoId)) {
      continue
    }
    seen.add(videoId)
    selected.push(videoId)
    if (selected.length >= limit) {
      break
    }
  }

  return selected
}
