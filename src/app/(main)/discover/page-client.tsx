"use client";

import Discover from "@/components/pages/Discover";
import type { YouTubeTrendingItem } from "@/types/api";

export default function DiscoverPageClient({
  initialTrending,
}: {
  initialTrending?: YouTubeTrendingItem[];
}) {
  return <Discover initialTrending={initialTrending} />;
}
