"use client";

import { Globe } from "lucide-react";
import PublicTaskList from "@/components/pages/PublicTaskList";
import { useI18n } from "@/lib/i18n-context";
import type { PublicTaskListItem } from "@/types/api";

interface ExploreProps {
  initialItems?: PublicTaskListItem[];
  initialTotal?: number;
}

export default function Explore({ initialItems, initialTotal }: ExploreProps) {
  const { t } = useI18n();

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-1">
        <Globe className="w-6 h-6" style={{ color: "var(--app-primary)" }} />
        <h1 className="text-h1" style={{ color: "var(--app-text)" }}>
          {t("explore.pageTitle")}
        </h1>
      </div>
      <p className="text-base mt-2 mb-6" style={{ color: "var(--app-text-muted)" }}>
        {t("explore.pageSubtitle")}
      </p>
      <PublicTaskList initialItems={initialItems} initialTotal={initialTotal} />
    </div>
  );
}
