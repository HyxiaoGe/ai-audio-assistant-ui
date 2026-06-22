"use client";

import { Suspense, useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useRouter, useSearchParams } from "next/navigation";
import Settings from "@/components/pages/Settings";
import FullPageLoader from "@/components/common/FullPageLoader";

function SettingsContent() {
  const status = useAuthStore((s) => s.status);
  const searchParams = useSearchParams();
  const router = useRouter();

  // 后端把 YouTube OAuth 回调重定向到 /settings?youtube=connected，这里转发到 /subscriptions
  useEffect(() => {
    const youtubeParam = searchParams.get("youtube");
    if (youtubeParam) {
      const reason = searchParams.get("reason");
      const params = new URLSearchParams();
      params.set("youtube", youtubeParam);
      if (reason) params.set("reason", reason);
      router.replace(`/subscriptions?${params.toString()}`);
    }
  }, [searchParams, router]);

  if (status === "loading") return <FullPageLoader />;
  return <Settings />;
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <SettingsContent />
    </Suspense>
  );
}
