"use client";

import { Suspense, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useTheme } from "next-themes";
import { useSearchParams } from "next/navigation";
import Subscriptions from "@/components/pages/Subscriptions";
import LoginModal from "@/components/auth/LoginModal";
import { useSettings } from "@/lib/settings-context";
import FullPageLoader from "@/components/common/FullPageLoader";

function SubscriptionsContent() {
  const authUser = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const { setTheme } = useSettings();
  const { resolvedTheme } = useTheme();
  const [loginOpen, setLoginOpen] = useState(false);
  const searchParams = useSearchParams();


  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  if (status === "loading") {
    return <FullPageLoader />;
  }

  return (
    <>
      <Subscriptions
        isAuthenticated={!!authUser}
        onOpenLogin={() => setLoginOpen(true)}
        onToggleTheme={toggleTheme}
        searchParams={searchParams}
      />
      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        callbackUrl="/subscriptions"
      />
    </>
  );
}

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <SubscriptionsContent />
    </Suspense>
  );
}
