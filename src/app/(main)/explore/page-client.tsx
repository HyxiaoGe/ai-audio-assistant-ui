"use client";

import Explore from "@/components/pages/Explore";
import type { PublicTaskListItem } from "@/types/api";

export default function ExplorePageClient({
  initialItems,
  initialTotal,
}: {
  initialItems?: PublicTaskListItem[];
  initialTotal?: number;
}) {
  return <Explore initialItems={initialItems} initialTotal={initialTotal} />;
}
