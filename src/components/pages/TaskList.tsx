"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import TaskCard from '@/components/task/TaskCard';
import EmptyState from '@/components/common/EmptyState';
import { useAPIClient } from '@/lib/use-api-client';
import { useDateFormatter } from '@/lib/use-date-formatter';
import { ApiError } from '@/types/api';
import type { TaskListItem, TaskStatus } from '@/types/api';
import { useI18n } from '@/lib/i18n-context';
import { notifyError, notifySuccess } from '@/lib/notify';

interface TaskListProps {
  isAuthenticated: boolean;
  onOpenLogin: () => void;
  onOpenNewTask?: () => void;
  language?: 'zh' | 'en';
  onToggleLanguage?: () => void;
  onToggleTheme?: () => void;
}

export default function TaskList({
  isAuthenticated,
  onOpenLogin,
  onOpenNewTask,
  language = 'zh',
  onToggleLanguage = () => {},
  onToggleTheme = () => {}
}: TaskListProps) {
  const router = useRouter();
  const client = useAPIClient();
  const { formatRelativeTime } = useDateFormatter();
  const { t } = useI18n();
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalTasks, setTotalTasks] = useState(0);
  const [statusCounts, setStatusCounts] = useState({
    all: 0,
    processing: 0,
    completed: 0,
    failed: 0
  });
  const [filterStatus, setFilterStatus] = useState<'all' | 'processing' | 'completed' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [retryingTaskId, setRetryingTaskId] = useState<string | null>(null);
  const tasksPerPage = 10;

  useEffect(() => {
    if (!isAuthenticated) {
      setTasks([]);
      setLoading(false);
      setError(null);
      setTotalTasks(0);
      return;
    }

    let isMounted = true;
    const loadTasks = async () => {
      setLoading(true);
      setError(null);
      try {
        const statusParam = filterStatus === 'processing' ? 'processing' : filterStatus;

        const result = await client.getTasks({
          page: currentPage,
          page_size: tasksPerPage,
          status: statusParam as TaskStatus | 'all',
        });
        if (isMounted) {
          setTasks(result.items);
          setTotalTasks(result.total);
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
  }, [client, currentPage, filterStatus, isAuthenticated, onOpenLogin, t]);

  useEffect(() => {
    if (!isAuthenticated) {
      setStatusCounts({ all: 0, processing: 0, completed: 0, failed: 0 });
      return;
    }

    let isMounted = true;
    const loadCounts = async () => {
      try {
        const [allRes, completedRes, failedRes, processingRes] =
          await Promise.all([
            client.getTasks({ page: 1, page_size: 1, status: 'all' }),
            client.getTasks({ page: 1, page_size: 1, status: 'completed' }),
            client.getTasks({ page: 1, page_size: 1, status: 'failed' }),
            client.getTasks({ page: 1, page_size: 1, status: 'processing' })
          ]);

        if (!isMounted) return;

        setStatusCounts({
          all: allRes.total,
          processing: processingRes.total,
          completed: completedRes.total,
          failed: failedRes.total
        });
      } catch (err) {
        if (err instanceof ApiError && err.code >= 40100 && err.code < 40200) {
          onOpenLogin();
        }
      }
    };

    loadCounts();
    return () => {
      isMounted = false;
    };
  }, [client, isAuthenticated, onOpenLogin]);

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

  const handleTaskClick = (taskId: string) => {
    router.push(`/tasks/${taskId}`);
  };

  const handleRetryTask = async (taskId: string) => {
    if (retryingTaskId) return;

    setRetryingTaskId(taskId);
    try {
      const result = await client.retryTask(taskId, false);
      if (result.action === 'duplicate_found') {
        const duplicateId = result.duplicate_task_id;
        if (!duplicateId) {
          notifyError(t("task.retryFailed"));
          return;
        }

        const failedIds = result.failed_task_ids || [];
        if (failedIds.length > 0 && typeof window !== "undefined") {
          const storageKey = `task-cleanup:${duplicateId}`;
          window.sessionStorage.setItem(
            storageKey,
            JSON.stringify({ failedTaskIds: failedIds, savedAt: Date.now() })
          );
        }

        router.push(`/tasks/${duplicateId}`);
        return;
      }

      notifySuccess(t("task.retrySuccess"));
    } catch (err) {
      if (err instanceof ApiError) {
        notifyError(err.message);
      } else {
        notifyError(t("task.retryFailed"));
      }
    } finally {
      setRetryingTaskId(null);
    }
  };

  // 搜索关键词筛选（当前页数据）
  const filteredTasks = tasks.filter(task => {
    if (!searchQuery.trim()) return true;
    return task.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // 计算分页（服务端已分页，这里只显示当前页数据）
  const totalPages = Math.ceil(totalTasks / tasksPerPage);
  const startIndex = (currentPage - 1) * tasksPerPage;
  const endIndex = startIndex + filteredTasks.length;
  const currentTasks = filteredTasks;

  // 切换状态时重置到第一页
  const handleStatusChange = (status: 'all' | 'processing' | 'completed' | 'failed') => {
    setFilterStatus(status);
    setCurrentPage(1);
  };

  // 搜索时重置到第一页
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'processing':
        return t("tasks.filterProcessing");
      case 'completed':
        return t("tasks.filterCompleted");
      case 'failed':
        return t("tasks.filterFailed");
      default:
        return '';
    }
  };

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
        <main className="flex-1 overflow-y-auto p-8">
          {/* 标题区域 */}
          <div className="mb-6">
            <h2
              className="text-h2"
              style={{ color: "var(--app-text)" }}
            >
              {t("tasks.pageTitle")}
            </h2>
            <p className="text-base mt-2" style={{ color: "var(--app-text-muted)" }}>
              {t("tasks.pageSubtitle")}
            </p>
          </div>

          {/* 筛选器 */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => handleStatusChange('all')}
              className="glass-chip px-4 py-2 rounded-lg text-sm"
              data-active={filterStatus === 'all'}
            >
              {t("tasks.filterAll")} ({statusCounts.all})
            </button>
            <button
              onClick={() => handleStatusChange('processing')}
              className="glass-chip px-4 py-2 rounded-lg text-sm"
              data-active={filterStatus === 'processing'}
            >
              {t("tasks.filterProcessing")} ({statusCounts.processing})
            </button>
            <button
              onClick={() => handleStatusChange('completed')}
              className="glass-chip px-4 py-2 rounded-lg text-sm"
              data-active={filterStatus === 'completed'}
            >
              {t("tasks.filterCompleted")} ({statusCounts.completed})
            </button>
            <button
              onClick={() => handleStatusChange('failed')}
              className="glass-chip px-4 py-2 rounded-lg text-sm"
              data-active={filterStatus === 'failed'}
            >
              {t("tasks.filterFailed")} ({statusCounts.failed})
            </button>
          </div>

          {/* 搜索框 */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <Search className="w-5 h-5" style={{ color: "var(--app-text-subtle)" }} />
              </div>
              <input
                type="text"
                placeholder={t("tasks.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="glass-control w-full pl-10 pr-4 py-2.5 rounded-lg text-sm"
                style={{
                  color: "var(--app-text)"
                }}
              />
              {searchQuery && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <button
                    onClick={() => handleSearchChange('')}
                    className="glass-chip text-xs px-2 py-1 rounded"
                    style={{ color: "var(--app-text-subtle)" }}
                  >
                    {t("tasks.clearSearch")}
                  </button>
                </div>
              )}
            </div>
            {searchQuery && (
              <p className="mt-2 text-sm" style={{ color: "var(--app-text-muted)" }}>
                {t("tasks.searchResults", { count: filteredTasks.length })}
              </p>
            )}
          </div>

          {/* 任务列表 */}
          <div className="space-y-3">
            {!isAuthenticated ? (
              <EmptyState
                variant="default"
                title={t("tasks.loginToViewTitle")}
                description={t("tasks.loginToViewDescription")}
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
            ) : currentTasks.length > 0 ? (
              currentTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  id={task.id}
                  title={task.title}
                  duration={formatDurationLabel(task.duration_seconds)}
                  timeAgo={formatRelativeTime(task.created_at)}
                  status={displayStatus(task.status)}
                  type={task.source_type === 'youtube' ? 'video' : 'file'}
                  onClick={() => handleTaskClick(task.id)}
                  onRetry={() => handleRetryTask(task.id)}
                  isRetrying={retryingTaskId === task.id}
                />
              ))
            ) : (
              // 空状态：区分搜索无结果和真的没有任务
              searchQuery ? (
                <EmptyState
                  variant="search"
                  title={t("tasks.noResultTitle")}
                  description={t("tasks.noResultDescription")}
                  action={{
                    label: t("tasks.clearFilters"),
                    onClick: () => {
                      setSearchQuery('');
                      setFilterStatus('all');
                    },
                    variant: 'secondary'
                  }}
                />
              ) : (
                <EmptyState
                  variant="default"
                  title={filterStatus === "all"
                    ? t("tasks.noTaskTitleAll")
                    : t("tasks.noTaskTitle", { status: getStatusText(filterStatus) })}
                  description={filterStatus === 'all' ? t("tasks.noTaskDescriptionAll") : t("tasks.noTaskDescriptionFiltered")}
                  action={filterStatus === 'all' ? {
                    label: t("dashboard.createTask"),
                    onClick: () => {
                      if (onOpenNewTask) {
                        onOpenNewTask()
                      }
                    },
                    variant: 'primary'
                  } : {
                    label: t("tasks.viewAll"),
                    onClick: () => setFilterStatus('all'),
                    variant: 'secondary'
                  }}
                />
              )
            )}
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="glass-chip flex items-center justify-center w-9 h-9 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* 页码显示 */}
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  // 只显示当前页前后2页
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className="glass-chip flex items-center justify-center min-w-9 h-9 px-3 rounded-lg text-sm"
                        data-active={page === currentPage}
                      >
                        {page}
                      </button>
                    );
                  } else if (
                    page === currentPage - 2 ||
                    page === currentPage + 2
                  ) {
                    return (
                      <span
                        key={page}
                        className="flex items-center justify-center w-9 h-9 text-sm"
                        style={{ color: "var(--app-text-subtle)" }}
                      >
                        ...
                      </span>
                    );
                  }
                  return null;
                })}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="glass-chip flex items-center justify-center w-9 h-9 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 分页信息 */}
          {filteredTasks.length > 0 && (
            <div className="text-center mt-4">
              <p className="text-sm" style={{ color: "var(--app-text-subtle)" }}>
                {t("tasks.pagination", {
                  from: startIndex + 1,
                  to: Math.min(endIndex, totalTasks),
                  total: totalTasks
                })}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
