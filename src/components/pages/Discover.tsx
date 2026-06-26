"use client"

import { useCallback, useEffect, useState } from "react"
import { Search } from "lucide-react"
import { useAPIClient } from "@/lib/use-api-client"
import { useI18n } from "@/lib/i18n-context"
import { useAuthStore } from "@/store/auth-store"
import { useUIStore } from "@/store/ui-store"
import { useDiscoverStore } from "@/store/discover-store"
import VideoCard from "@/components/youtube/VideoCard"
import { Button } from "@/components/ui/button"
import type { VideoHit, YouTubeTrendingItem, YouTubeVideoItem } from "@/types/api"

interface DiscoverProps {
  initialTrending?: YouTubeTrendingItem[]
}

// VideoHit → VideoCard 需要的最小形状(video_id/title/thumbnail_url/transcribed)
function hitToVideoItem(hit: VideoHit): YouTubeVideoItem {
  return {
    video_id: hit.video_id,
    title: hit.title,
    thumbnail_url: hit.thumbnail ?? undefined,
    transcribed: false,
  } as unknown as YouTubeVideoItem
}

export default function Discover({ initialTrending }: DiscoverProps) {
  const { t } = useI18n()
  const client = useAPIClient()
  const isAuthenticated = !!useAuthStore((s) => s.user)
  const openLogin = useUIStore((s) => s.openLogin)
  const openNewTask = useUIStore((s) => s.openNewTask)

  // 初值从会话级缓存还原:侧栏切走/切回会卸载本组件,本地 state 全丢,靠 store 把上一次搜索带回来。
  const [query, setQuery] = useState(() => useDiscoverStore.getState().query)
  const [hits, setHits] = useState<VideoHit[]>(() => useDiscoverStore.getState().hits)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [searched, setSearched] = useState(() => useDiscoverStore.getState().searched)

  const [trending, setTrending] = useState<YouTubeTrendingItem[]>(initialTrending ?? [])
  const seeded = initialTrending !== undefined

  useEffect(() => {
    if (seeded) return // SSR 已注入则不再客户端拉取
    let alive = true
    client
      .getYouTubeTrending({ limit: 10 })
      .then((res) => {
        if (alive) setTrending(res.items)
      })
      .catch(() => {
        /* 热门拉取失败静默:非关键路径 */
      })
    return () => {
      alive = false
    }
  }, [seeded, client])

  const handleChip = (term: string) => {
    setQuery(term)
    void runSearch(term)
  }

  const runSearch = useCallback(
    async (raw: string) => {
      const q = raw.trim()
      if (!q) return
      setLoading(true)
      setErrorMsg(null)
      setSearched(true)
      try {
        const res = await client.searchYouTube(q, { authenticated: isAuthenticated })
        setHits(res.items)
        // 写回会话缓存:词与结果一起存,切回 /discover 时即时还原、零网络。
        useDiscoverStore.getState().saveSearch(q, res.items)
      } catch (e) {
        setHits([])
        setErrorMsg(e instanceof Error ? e.message : t("discover.searchError"))
      } finally {
        setLoading(false)
      }
    },
    [client, isAuthenticated, t],
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void runSearch(query)
  }

  const handleTranscribe = (videoUrl: string, videoId: string) => {
    if (!isAuthenticated) {
      openLogin()
      return
    }
    openNewTask({ initialVideoUrl: videoUrl, initialYouTubeVideoId: videoId })
  }

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-1">
        <Search className="w-6 h-6 text-[var(--app-primary)]" />
        <h1 className="text-h1 text-[var(--app-text)]">{t("discover.pageTitle")}</h1>
      </div>
      <p className="text-[var(--app-text-muted)] mb-6">{t("discover.pageSubtitle")}</p>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-6 max-w-2xl">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("discover.searchPlaceholder")}
          aria-label={t("discover.searchPlaceholder")}
          className="flex-1 rounded-lg px-4 py-2 bg-[var(--app-glass-bg)] border border-[var(--app-border)] text-[var(--app-text)] placeholder:text-[var(--app-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--app-primary)]"
        />
        <Button type="submit" disabled={loading}>
          {t("discover.searchButton")}
        </Button>
      </form>

      {trending.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-sm text-[var(--app-text-muted)]">{t("discover.trendingLabel")}</span>
          {trending.map((item) => (
            <Button key={item.query} variant="secondary" size="sm" onClick={() => handleChip(item.query)}>
              {item.query}
            </Button>
          ))}
        </div>
      )}

      {loading && <p className="text-[var(--app-text-muted)]">{t("discover.loading")}</p>}
      {errorMsg && <p className="text-[var(--app-danger)]">{errorMsg}</p>}
      {!loading && !errorMsg && searched && hits.length === 0 && (
        <p className="text-[var(--app-text-muted)]">{t("discover.empty")}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {hits.map((hit) => (
          <VideoCard key={hit.video_id} video={hitToVideoItem(hit)} onTranscribe={handleTranscribe} />
        ))}
      </div>
    </div>
  )
}
