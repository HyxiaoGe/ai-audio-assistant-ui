"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import Dashboard from "@/components/pages/Dashboard";
import FullPageLoader from "@/components/common/FullPageLoader";

export default function DashboardPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);

  // 未登录且登录态已解析 → 重定向到探索广场（保留原行为）。
  const shouldRedirect = status !== "loading" && !authUser;
  useEffect(() => {
    if (shouldRedirect) {
      router.replace("/explore");
    }
  }, [shouldRedirect, router]);

  if (status === "loading") return <FullPageLoader />;
  if (!authUser) return <FullPageLoader />;

  return <Dashboard />;
}
