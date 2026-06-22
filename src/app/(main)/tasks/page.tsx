"use client";

import { useAuthStore } from "@/store/auth-store";
import TaskList from "@/components/pages/TaskList";
import FullPageLoader from "@/components/common/FullPageLoader";

export default function TaskListPage() {
  const status = useAuthStore((s) => s.status);
  if (status === "loading") return <FullPageLoader />;
  return <TaskList />;
}
