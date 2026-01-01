"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import NewTaskCard from '@/components/task/NewTaskCard';
import TaskCard from '@/components/task/TaskCard';
import EmptyState from '@/components/common/EmptyState';
import { useAPIClient } from '@/lib/use-api-client';
import { useDateFormatter } from '@/lib/use-date-formatter';
import { ApiError } from '@/types/api';
import type { TaskListItem, TaskStatus } from '@/types/api';
import { useI18n } from '@/lib/i18n-context';
import { useGlobalStore } from '@/store/global-store';

interface DashboardProps {
  isAuthenticated: boolean;
  onOpenLogin: () => void;
  onOpenNewTask?: () => void;
  userName?: string | null;
  language?: 'zh' | 'en';
  onToggleLanguage?: () => void;
  onToggleTheme?: () => void;
}

export default function Dashboard({ 
  isAuthenticated, 
  onOpenLogin,
  onOpenNewTask,
  userName,
  language = 'zh',
  onToggleLanguage = () => {},
  onToggleTheme = () => {}
}: DashboardProps) {
  const router = useRouter();
  const client = useAPIClient();
  const { formatRelativeTime } = useDateFormatter();
  const { t } = useI18n();
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get real-time task updates from WebSocket
  const globalTasks = useGlobalStore((state) => state.tasks);

  // Load tasks from API
  useEffect(() => {
    if (!isAuthenticated) {
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
        const result = await client.getTasks({ page: 1, page_size: 5, status: 'all' });
        if (isMounted) {
          setTasks(result.items);
        }
      } catch (err) {
        if (isMounted) {
          if (err instanceof ApiError) {
            setError(err.message);
            if (err.code >= 40100 && err.code < 40200) {
              onOpenLogin();
            }
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
  }, [client, isAuthenticated, onOpenLogin, t]);

  // Sync WebSocket task updates to local task list
  useEffect(() => {
    if (tasks.length === 0) return;

    setTasks((prevTasks) =>
      prevTasks.map((task) => {
        const globalTask = globalTasks[task.id];
        if (globalTask) {
          // Update task with WebSocket data
          return {
            ...task,
            status: globalTask.status,
            progress: globalTask.progress,
            error_message: globalTask.error_message,
          };
        }
        return task;
      })
    );
  }, [globalTasks, tasks.length]);

  const formatDurationLabel = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '--';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return t("time.minutes", { count: minutes });
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder === 0
      ? t("time.hours", { count: hours })
      : t("time.hoursMinutes", { hours, minutes: remainder });
  };

  const displayStatus = (status: TaskStatus) => {
    if (status === 'completed') return 'completed';
    if (status === 'failed') return 'failed';
    return 'processing';
  };

  const displayTasks = useMemo(() => tasks.slice(0, 5), [tasks]);

  const handleNewTask = () => {
    if (!isAuthenticated) {
      onOpenLogin();
    } else {
      if (onOpenNewTask) {
        onOpenNewTask();
      }
    }
  };

  const handleTaskClick = (taskId: string) => {
    router.push(`/tasks/${taskId}`);
  };

  // 获取最近任务（最多5个）
  const hasNoTasks = displayTasks.length === 0;

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--app-bg)" }}>
      {/* Header */}
      <Header 
        isAuthenticated={isAuthenticated} 
        onOpenLogin={onOpenLogin}
        language={language}
        onToggleLanguage={onToggleLanguage}
        onToggleTheme={onToggleTheme}
      />

      {/* 主体：Sidebar + 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto p-8" style={{ background: "var(--app-bg)" }}>
          {/* 欢迎区域 */}
          <div className="mb-8">
            <h2 
              className="text-h2"
              style={{ color: "var(--app-text)" }}
            >
              {t("dashboard.welcome")}{userName ? `，${userName}` : `，${t("dashboard.friend")}`} 👋
            </h2>
          </div>

          {/* 新建任务卡片 */}
          <div className="mb-8">
            <NewTaskCard onClick={handleNewTask} />
          </div>

          {/* 最近任务 */}
          <div>
            <h3 
              className="text-h3 mb-4"
              style={{ color: "var(--app-text)" }}
            >
              {t("dashboard.recentTasks")}
            </h3>

            {/* 任务列表 */}
            <div className="space-y-3">
              {!isAuthenticated ? (
                <EmptyState
                  variant="default"
                  title={t("dashboard.loginToViewTitle")}
                  description={t("dashboard.loginToViewDescription")}
                  action={{
                    label: t("dashboard.goLogin"),
                    onClick: onOpenLogin,
                    variant: 'primary'
                  }}
                />
              ) : loading ? (
                <div className="text-sm" style={{ color: "var(--app-text-muted)" }}>
                  {t("common.loading")}...
                </div>
              ) : error ? (
                <div className="text-sm" style={{ color: "var(--app-danger)" }}>
                  {error}
                </div>
              ) : hasNoTasks ? (
                <EmptyState 
                  variant="default"
                  title={t("dashboard.emptyTitle")}
                  description={t("dashboard.emptyDescription")}
                  action={{
                    label: t("dashboard.createTask"),
                    onClick: handleNewTask,
                    variant: 'primary'
                  }}
                />
              ) : (
                displayTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    id={task.id}
                    title={task.title}
                    duration={formatDurationLabel(task.duration_seconds)}
                    timeAgo={formatRelativeTime(task.created_at)}
                    status={displayStatus(task.status)}
                    type={task.source_type === 'youtube' ? 'video' : 'file'}
                    onClick={() => handleTaskClick(task.id)}
                  />
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
