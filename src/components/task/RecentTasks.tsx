"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import EmptyState from "@/components/common/EmptyState";
import TaskCard from "@/components/task/TaskCard";
import { useAPIClient } from "@/lib/use-api-client";
import { useDateFormatter } from "@/lib/use-date-formatter";
import { ApiError } from "@/types/api";
import type { TaskListItem, TaskStatus } from "@/types/api";
import { useI18n } from "@/lib/i18n-context";

export const RecentTasks = () => {
  const { data: session } = useSession();
  const client = useAPIClient();
  const { formatRelativeTime } = useDateFormatter();
  const { t } = useI18n();
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user) {
      setTasks([]);
      setLoading(false);
      setError(null);
      return;
    }

    let isMounted = true;
    const loadTasks = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await client.getTasks({ page: 1, page_size: 5, status: "all" });
        if (isMounted) {
          setTasks(result.items);
        }
      } catch (err) {
        if (isMounted) {
          if (err instanceof ApiError) {
            setError(err.message);
          } else {
            setError(err instanceof Error ? err.message : t("errors.loadTaskFailed"));
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadTasks();
    return () => {
      isMounted = false;
    };
  }, [client, session, t]);

  const formatDurationLabel = (seconds?: number) => {
    if (!seconds || seconds <= 0) return "--";
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return t("time.minutes", { count: minutes });
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder === 0
      ? t("time.hours", { count: hours })
      : t("time.hoursMinutes", { hours, minutes: remainder });
  };

  const displayStatus = (status: TaskStatus) => {
    if (status === "completed") return "completed";
    if (status === "failed") return "failed";
    return "processing";
  };

  const recentTasks = tasks.slice(0, 5);

  if (!session?.user) {
    return (
      <EmptyState
        title={t("dashboard.loginToViewTitle")}
        description={t("dashboard.loginToViewDescription")}
      />
    );
  }

  if (loading) {
    return (
      <div className="text-sm" style={{ color: "var(--app-text-muted)" }}>
        {t("common.loading")}...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm" style={{ color: "var(--app-danger)" }}>
        {error}
      </div>
    );
  }

  if (recentTasks.length === 0) {
    return (
      <EmptyState
        title={t("dashboard.emptyTitle")}
        description={t("dashboard.emptyDescription")}
      />
    );
  }

  return (
    <div className="space-y-3">
      {recentTasks.map((task) => (
        <TaskCard
          key={task.id}
          id={task.id}
          title={task.title}
          duration={formatDurationLabel(task.duration_seconds)}
          timeAgo={formatRelativeTime(task.created_at)}
          status={displayStatus(task.status)}
          type={task.source_type === "youtube" ? "video" : "file"}
        />
      ))}
    </div>
  );
};
