"use client";

import { Suspense } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useSearchParams } from "next/navigation";
import Subscriptions from "@/components/pages/Subscriptions";
import FullPageLoader from "@/components/common/FullPageLoader";

function SubscriptionsContent() {
  const status = useAuthStore((s) => s.status);
  const searchParams = useSearchParams();
  if (status === "loading") return <FullPageLoader />;
  return <Subscriptions searchParams={searchParams} />;
}

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <SubscriptionsContent />
    </Suspense>
  );
}
