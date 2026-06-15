"use client";

import { Globe } from "lucide-react";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import PublicTaskList from "@/components/pages/PublicTaskList";
import { useI18n } from "@/lib/i18n-context";
import type { PublicTaskListItem } from "@/types/api";

interface ExploreProps {
  isAuthenticated: boolean;
  onOpenLogin: () => void;
  onToggleTheme?: () => void;
  initialItems?: PublicTaskListItem[];
  initialTotal?: number;
}

export default function Explore({
  isAuthenticated,
  onOpenLogin,
  onToggleTheme,
  initialItems,
  initialTotal,
}: ExploreProps) {
  const { t } = useI18n();

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--app-bg)" }}>
      <Header isAuthenticated={isAuthenticated} onOpenLogin={onOpenLogin} onToggleTheme={onToggleTheme} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="flex items-center gap-3 mb-1">
            <Globe className="w-6 h-6" style={{ color: "var(--app-primary)" }} />
            <h2 className="text-h2" style={{ color: "var(--app-text)" }}>
              {t("explore.pageTitle")}
            </h2>
          </div>
          <p className="text-base mt-2 mb-6" style={{ color: "var(--app-text-muted)" }}>
            {t("explore.pageSubtitle")}
          </p>
          <PublicTaskList initialItems={initialItems} initialTotal={initialTotal} />
        </main>
      </div>
    </div>
  );
}
