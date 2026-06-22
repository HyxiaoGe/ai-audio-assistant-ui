"use client";

import { useAuthStore } from "@/store/auth-store";
import Notifications from "@/components/pages/Notifications";
import FullPageLoader from "@/components/common/FullPageLoader";

export default function NotificationsPage() {
  const status = useAuthStore((s) => s.status);
  if (status === "loading") return <FullPageLoader />;
  return <Notifications />;
}
