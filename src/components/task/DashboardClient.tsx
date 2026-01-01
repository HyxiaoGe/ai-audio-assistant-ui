"use client";

import { useState } from "react";
import NewTaskCard from "@/components/task/NewTaskCard";
import NewTaskModal from "@/components/task/NewTaskModal";
import { RecentTasks } from "@/components/task/RecentTasks";
import { useI18n } from "@/lib/i18n-context";

interface DashboardClientProps {
  userName?: string | null;
}

export const DashboardClient = ({ userName }: DashboardClientProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { t } = useI18n();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">
        {t("dashboard.welcome")}{userName ? `，${userName}` : `，${t("dashboard.friend")}`}
      </h1>

      <NewTaskCard onClick={() => setIsModalOpen(true)} />
      <NewTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <section>
        <h2 className="mb-4 text-lg font-medium">{t("dashboard.recentTasks")}</h2>
        <RecentTasks />
      </section>
    </div>
  );
};
