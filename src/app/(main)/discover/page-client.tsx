"use client";

import Discover from "@/components/pages/Discover";
import type { VideoHit, YouTubeTrendingItem } from "@/types/api";

export default function DiscoverPageClient({
  initialTrending,
  initialRecommendations,
}: {
  initialTrending?: YouTubeTrendingItem[];
  initialRecommendations?: VideoHit[];
}) {
  return (
    <Discover
      initialTrending={initialTrending}
      initialRecommendations={initialRecommendations}
    />
  );
}
