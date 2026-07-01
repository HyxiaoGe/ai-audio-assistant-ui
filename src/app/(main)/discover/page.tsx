import type { Metadata } from "next";
import { fetchYouTubeTrending, fetchRecommendations } from "@/lib/server-api";
import DiscoverPageClient from "./page-client";

export const metadata: Metadata = {
  title: "发现 · 搜索 YouTube · AI 音视频助手",
  description: "按关键词搜索 YouTube 视频并直接转写，无需订阅频道",
  alternates: { canonical: "/discover" },
};

const TRENDING_LIMIT = 10;
const RECOMMENDATIONS_LIMIT = 12;

export default async function DiscoverPage() {
  const [trending, recommendations] = await Promise.all([
    fetchYouTubeTrending(TRENDING_LIMIT),
    fetchRecommendations(RECOMMENDATIONS_LIMIT),
  ]);
  return (
    <DiscoverPageClient
      initialTrending={trending?.items}
      initialRecommendations={recommendations?.items}
    />
  );
}
