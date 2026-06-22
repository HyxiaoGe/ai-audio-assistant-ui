"use client";

import { useAuthStore } from "@/store/auth-store";
import Stats from "@/components/pages/Stats";
import FullPageLoader from "@/components/common/FullPageLoader";

export default function StatsPage() {
  const status = useAuthStore((s) => s.status);
  if (status === "loading") return <FullPageLoader />;
  return <Stats />;
}
