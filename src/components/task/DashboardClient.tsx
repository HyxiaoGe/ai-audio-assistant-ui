"use client";

import { useState } from "react";
import NewTaskCard from "@/components/task/NewTaskCard";
import NewTaskModal from "@/components/task/NewTaskModal";
import { RecentTasks } from "@/components/task/RecentTasks";

interface DashboardClientProps {
  userName?: string | null;
}

export const DashboardClient = ({ userName }: DashboardClientProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">欢迎回来，{userName ?? "朋友"}</h1>

      <NewTaskCard onClick={() => setIsModalOpen(true)} />
      <NewTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={() => setIsModalOpen(false)}
      />

      <section>
        <h2 className="mb-4 text-lg font-medium">最近任务</h2>
        <RecentTasks />
      </section>
    </div>
  );
};
