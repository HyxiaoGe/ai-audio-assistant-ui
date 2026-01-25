"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { useRouter, useSearchParams } from "next/navigation";
import Settings from "@/components/pages/Settings";
import LoginModal from "@/components/auth/LoginModal";
import { useSettings } from "@/lib/settings-context";
import FullPageLoader from "@/components/common/FullPageLoader";

function SettingsContent() {
  const { data: session, status } = useSession();
  const { setTheme } = useSettings();
  const { resolvedTheme } = useTheme();
  const [loginOpen, setLoginOpen] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Handle YouTube OAuth callback redirect
  // Backend redirects to /settings?youtube=connected, we forward to /subscriptions
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


  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  if (status === "loading") {
    return <FullPageLoader />;
  }

  return (
    <>
      <Settings
        isAuthenticated={!!session?.user}
        onOpenLogin={() => setLoginOpen(true)}
        onToggleTheme={toggleTheme}
      />
      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        callbackUrl="/settings"
      />
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <SettingsContent />
    </Suspense>
  );
}
