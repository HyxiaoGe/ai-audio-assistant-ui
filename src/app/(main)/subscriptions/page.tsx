"use client";

import { Suspense, useState } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { useSearchParams } from "next/navigation";
import Subscriptions from "@/components/pages/Subscriptions";
import LoginModal from "@/components/auth/LoginModal";
import { useSettings } from "@/lib/settings-context";
import FullPageLoader from "@/components/common/FullPageLoader";

function SubscriptionsContent() {
  const { data: session, status } = useSession();
  const { language, setLanguage, setTheme } = useSettings();
  const { resolvedTheme } = useTheme();
  const [loginOpen, setLoginOpen] = useState(false);
  const searchParams = useSearchParams();

  const toggleLanguage = () => {
    setLanguage(language === "zh" ? "en" : "zh");
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  if (status === "loading") {
    return <FullPageLoader />;
  }

  return (
    <>
      <Subscriptions
        isAuthenticated={!!session?.user}
        onOpenLogin={() => setLoginOpen(true)}
        language={language}
        onToggleLanguage={toggleLanguage}
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
