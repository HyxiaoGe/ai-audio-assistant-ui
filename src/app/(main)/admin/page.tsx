"use client";

import { useAuthStore } from "@/store/auth-store";
import Admin from "@/components/pages/Admin";
import FullPageLoader from "@/components/common/FullPageLoader";

export default function AdminPage() {
  const status = useAuthStore((s) => s.status);
  if (status === "loading") return <FullPageLoader />;
  return <Admin />;
}
