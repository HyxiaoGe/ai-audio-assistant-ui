"use client";

import { useAuthStore } from "@/store/auth-store";
import PublicTaskDetail from "@/components/pages/PublicTaskDetail";
import { usePublicOwnerRedirect } from "@/lib/use-public-owner-redirect";
import type { PublicSummaryResponse, PublicTaskDetail as PublicTaskDetailData } from "@/types/api";

interface PublicTaskDetailPageClientProps {
  id: string;
  initialDetail?: PublicTaskDetailData;
  initialSummary?: PublicSummaryResponse;
}

export default function PublicTaskDetailPageClient({
  id,
  initialDetail,
  initialSummary,
}: PublicTaskDetailPageClientProps) {
  const authUser = useAuthStore((s) => s.user);
  // 直达/书签命中本人公开内容 → 跳私有详情；匿名/他人内容留在公开详情。
  usePublicOwnerRedirect(id, !!authUser);

  return (
    // key={id} 让 id 切换时整棵子树重挂，state 天然清零。
    <PublicTaskDetail key={id} initialDetail={initialDetail} initialSummary={initialSummary} />
  );
}
