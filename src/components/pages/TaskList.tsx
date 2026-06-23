"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Pagination } from '@/components/common/Pagination';
import TaskCard from '@/components/task/TaskCard';
import { TaskSearchInput } from '@/components/task/TaskSearchInput';
import { SearchSnippet } from '@/components/task/SearchSnippet';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import TaskCardSkeleton from '@/components/task/TaskCardSkeleton';
import { Button } from '@/components/ui/button';
import { useAPIClient } from '@/lib/use-api-client';
import { useDateFormatter } from '@/lib/use-date-formatter';
import { ApiError } from '@/types/api';
import type { TaskListItem, TaskSearchHit, TaskStatus } from '@/types/api';
import { useI18n } from '@/lib/i18n-context';
import { notifyError, notifySuccess } from '@/lib/notify';
import { useGlobalStore } from '@/store/global-store';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';

export default function TaskList() {
  const authUser = useAuthStore((s) => s.user);
  const isAuthenticated = !!authUser;
  const openLogin = useUIStore((s) => s.openLogin);
  const openNewTask = useUIStore((s) => s.openNewTask);
  const router = useRouter();
  // 搜索态的 source of truth 提升到 URL(?q=):列表与详情是两个独立 route segment,互跳必卸载、
  // 本地 state 丢失。把搜索词放进 URL 后,「详情返回 / 浏览器后退」都能据此还原(与详情 ?t= 深链同范式)。
  const searchParams = useSearchParams();
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
  // 初值从 URL ?q= 还原:从详情返回/浏览器后退回到带 ?q= 的列表时,搜索词与结果一并恢复
  // (searchHits 不必持久化——下方防抖 effect 依赖 searchQuery,恢复出 q 即自动重查)。
  const [searchQuery, setSearchQuery] = useState(() => searchParams?.get('q') ?? '');
  // 服务端转写搜索结果：null = 无激活搜索（显示常规列表），数组 = 当前查询的命中（可能为空 = 无结果）。
  const [searchHits, setSearchHits] = useState<TaskSearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [retryingTaskId, setRetryingTaskId] = useState<string | null>(null);
  // 自增计数：重试成功后 +1，触发列表与状态计数重新拉取，避免卡片停留在 failed 态。
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const tasksPerPage = 10;

  // 订阅全局 WS 任务态：列表此前纯 refetch（仅 mount/翻页/切筛选/重试时拉取），处理中卡片
  // 的标题/状态徽章全程停在 mount 快照，连 completed 通知都不刷新列表。这里对齐 Dashboard
  // 的正确范式，让卡片随 WS 进度即时刷新、状态计数在任务进入终态时重拉后端权威数。
  const globalTasks = useGlobalStore((state) => state.tasks);

  // 「已知任务进入终态(completed/failed)的次数」信号：仅在状态迁移到终态时变化（进度滴答
  // 不改变它），用作状态计数 effect 的依赖，触发一次后端权威 GROUP BY 重拉，避免本地 delta
  // 在分页外/跨筛选条目上错算。
  const terminalTaskSignal = Object.values(globalTasks).filter(
    (t) => t.status === 'completed' || t.status === 'failed'
  ).length;

  // 保存最新的 openLogin / t，但不让它们进入下方拉取 effect 的依赖——
  // 否则 zustand selector 引用变化会触发列表与
  // 状态计数反复 getTasks（一次开关多打 5 个请求）。
  const onOpenLoginRef = useRef(openLogin);
  const tRef = useRef(t);
  useEffect(() => {
    onOpenLoginRef.current = openLogin;
    tRef.current = t;
  });

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
              onOpenLoginRef.current();
            }
          } else {
            setError(err instanceof Error ? err.message : tRef.current("errors.loadTaskFailed"));
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
  }, [client, currentPage, filterStatus, isAuthenticated, reloadKey]);

  // 把 WS 实时态合并进当前页卡片：标题用 ?? 守卫避免 WS 未携带标题时以 undefined 覆盖本地值。
  // deps 用 tasks.length（非 tasks）避免本 effect 自身 setTasks 造成的回环。
  useEffect(() => {
    if (tasks.length === 0) return;
    setTasks((prevTasks) =>
      prevTasks.map((task) => {
        const globalTask = globalTasks[task.id];
        if (!globalTask) return task;
        return {
          ...task,
          status: globalTask.status,
          progress: globalTask.progress,
          error_message: globalTask.error_message,
          title: globalTask.title ?? task.title,
        };
      })
    );
  }, [globalTasks, tasks.length]);

  useEffect(() => {
    if (!isAuthenticated) {
      setStatusCounts({ all: 0, processing: 0, completed: 0, failed: 0 });
      return;
    }

    let isMounted = true;
    const loadCounts = async () => {
      try {
        // 一次请求拿全部状态计数（后端 GROUP BY），替代过去为四个 tab 各发一次
        // page_size=1 的列表查询（列表页加载 5 连发 → 2）。
        const counts = await client.getTaskStatusCounts();

        if (!isMounted) return;

        setStatusCounts({
          all: counts.all,
          processing: counts.processing,
          completed: counts.completed,
          failed: counts.failed
        });
      } catch (err) {
        if (err instanceof ApiError && err.code >= 40100 && err.code < 40200) {
          onOpenLoginRef.current();
        }
      }
    };

    loadCounts();
    return () => {
      isMounted = false;
    };
  }, [client, isAuthenticated, reloadKey, terminalTaskSignal]);

  // 服务端转写全文搜索：替换旧的「当前页标题 includes」客户端过滤（P1-6：翻页之外的命中被漏、
  // 且搜不到转写正文）。防抖 300ms 后打 GET /tasks/search（后端 pg_jieba 中文分词）；空查询不打
  // 服务端、清空命中回落常规列表。ignore 标记丢弃过期响应，避免快速改词时旧结果覆盖新结果。
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || !isAuthenticated) {
      setSearchHits(null);
      setSearching(false);
      return;
    }
    let ignore = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await client.searchTranscripts(q);
        if (!ignore) setSearchHits(res.hits);
      } catch (err) {
        if (!ignore) {
          setSearchHits([]);
          if (err instanceof ApiError && err.code >= 40100 && err.code < 40200) {
            onOpenLoginRef.current();
          }
        }
      } finally {
        if (!ignore) setSearching(false);
      }
    }, 300);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [searchQuery, client, isAuthenticated]);

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

  // 命中时间戳标签：H:MM:SS（不足 1 小时省略小时位）。供搜索结果显示「跳到哪一刻」。
  const formatTimestamp = (seconds: number) => {
    const total = Math.max(0, Math.floor(seconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  };

  const displayStatus = (status: TaskStatus) => {
    if (status === 'completed') return 'completed';
    if (status === 'failed') return 'failed';
    return 'processing';
  };

  // 稳定身份，使 memo 化的 TaskCard 不随列表重渲染（轮询/筛选/搜索）而整片重渲、毛玻璃背板不重栅格化。
  const handleTaskClick = useCallback((taskId: string) => {
    router.push(`/tasks/${taskId}`);
  }, [router]);

  const handleNewTask = () => {
    if (!isAuthenticated) {
      openLogin();
      return;
    }
    openNewTask();
  };

  const handleRetryTask = useCallback(async (taskId: string) => {
    if (retryingTaskId) return;

    setRetryingTaskId(taskId);
    try {
      const result = await client.retryTask(taskId, false);
      if ('action' in result && result.action === 'duplicate_found') {
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
      // 重试已提交：刷新列表与计数，让卡片从 failed 前进到 processing。
      setReloadKey((k) => k + 1);
    } catch (err) {
      if (err instanceof ApiError) {
        notifyError(err.message);
      } else {
        notifyError(t("task.retryFailed"));
      }
    } finally {
      setRetryingTaskId(null);
    }
  }, [retryingTaskId, client, t, router]);


  // 是否处于激活搜索态：有非空查询即用服务端命中替换常规列表（不再做当前页客户端过滤）。
  const isSearching = searchQuery.trim().length > 0;

  // 命中点击：深链到任务详情并带 ?t={start_time} 让详情页跳播到该时间戳；同时把来源搜索词 ?q=
  // 一并带进详情 URL,使详情页「返回」能回到 /tasks?q= 恢复搜索态(列表卸载会丢本地 state,靠 URL 还原)。
  const handleHitClick = useCallback((hit: TaskSearchHit) => {
    const q = searchQuery.trim();
    const base = `/tasks/${hit.task_id}?t=${hit.start_time}`;
    router.push(q ? `${base}&q=${encodeURIComponent(q)}` : base);
  }, [router, searchQuery]);

  // 计算分页（服务端已分页，这里只显示当前页数据）
  const totalPages = Math.ceil(totalTasks / tasksPerPage);
  const startIndex = (currentPage - 1) * tasksPerPage;
  const endIndex = startIndex + tasks.length;
  const currentTasks = tasks;

  // 切换状态时重置到第一页
  const handleStatusChange = (status: 'all' | 'processing' | 'completed' | 'failed') => {
    setFilterStatus(status);
    setCurrentPage(1);
  };

  // 搜索时重置到第一页，并把搜索词同步进 URL(?q=)以便返回/后退时还原。
  // 用 router.replace 而非 push:按键级写入若用 push 会把每个字符灌进历史栈、毁掉后退体验。
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
    const q = value.trim();
    router.replace(q ? `/tasks?q=${encodeURIComponent(q)}` : '/tasks');
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
    <div className="p-8">
          {/* 标题区域 */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h1
                className="text-h1"
                style={{ color: "var(--app-text)" }}
              >
                {t("tasks.pageTitle")}
              </h1>
              <p className="text-base mt-2" style={{ color: "var(--app-text-muted)" }}>
                {t("tasks.pageSubtitle")}
              </p>
            </div>
            <Button
              onClick={handleNewTask}
              className="text-white"
              style={{ background: "var(--app-action-gradient)" }}
            >
              {t("dashboard.createTask")}
            </Button>
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
            <TaskSearchInput value={searchQuery} onChange={handleSearchChange} />
            {isSearching && searchHits !== null && (
              <p className="mt-2 text-sm" style={{ color: "var(--app-text-muted)" }}>
                {t("tasks.searchResults", { count: searchHits.length })}
              </p>
            )}
          </div>

          {/* 任务列表 / 搜索结果 */}
          <div className="space-y-3">
            {!isAuthenticated ? (
              <div className="space-y-3">
                <EmptyState
                  variant="default"
                  title={t("tasks.loginToViewTitle")}
                  description={t("tasks.loginToViewDescription")}
                  action={{
                    label: t("dashboard.goLogin"),
                    onClick: openLogin,
                    variant: 'primary'
                  }}
                />
                <div className="flex justify-center">
                  <button
                    onClick={() => router.push('/explore')}
                    className="text-sm hover:underline underline-offset-4"
                    style={{ color: 'var(--app-primary)' }}
                  >
                    {t("explore.goExplore")}
                  </button>
                </div>
              </div>
            ) : isSearching ? (
              // 服务端转写搜索结果：命中渲染为可点卡片（标题 + 高亮片段 + 时间戳），点击深链跳播。
              searching && (searchHits === null || searchHits.length === 0) ? (
                <div style={{ minHeight: "72px" }} />
              ) : searchHits && searchHits.length > 0 ? (
                searchHits.map((hit) => (
                  <button
                    key={`${hit.task_id}-${hit.start_time}`}
                    type="button"
                    data-testid={`search-hit-${hit.task_id}`}
                    onClick={() => handleHitClick(hit)}
                    className="glass-control w-full text-left p-4 rounded-lg block"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium" style={{ color: "var(--app-text)" }}>
                        {hit.title ?? t("audio.untitled")}
                      </span>
                      <span className="text-xs shrink-0 tabular-nums" style={{ color: "var(--app-text-subtle)" }}>
                        {formatTimestamp(hit.start_time)}
                      </span>
                    </div>
                    <SearchSnippet text={hit.snippet} className="mt-1 block text-sm" />
                  </button>
                ))
              ) : (
                <EmptyState
                  variant="search"
                  title={t("tasks.noResultTitle")}
                  description={t("tasks.noResultDescription")}
                  action={{
                    label: t("tasks.clearSearch"),
                    onClick: () => setSearchQuery(''),
                    variant: 'secondary'
                  }}
                />
              )
            ) : loading && currentTasks.length === 0 ? (
              <TaskCardSkeleton count={6} />
            ) : error ? (
              <ErrorState type="network" description={error} onRetry={reload} />
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
                  onClick={handleTaskClick}
                  onRetry={handleRetryTask}
                  isRetrying={retryingTaskId === task.id}
                  publicLabel={task.is_public ? t('task.visibilityPublic') : undefined}
                />
              ))
            ) : (
              <EmptyState
                variant="default"
                title={filterStatus === "all"
                  ? t("tasks.noTaskTitleAll")
                  : t("tasks.noTaskTitle", { status: getStatusText(filterStatus) })}
                description={filterStatus === 'all' ? t("tasks.noTaskDescriptionAll") : t("tasks.noTaskDescriptionFiltered")}
                action={filterStatus === 'all' ? {
                  label: t("dashboard.createTask"),
                  onClick: () => openNewTask(),
                  variant: 'primary'
                } : {
                  label: t("tasks.viewAll"),
                  onClick: () => setFilterStatus('all'),
                  variant: 'secondary'
                }}
              />
            )}
          </div>

          {/* 分页（搜索态隐藏：搜索结果不分页） */}
          {!isSearching && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          )}

          {/* 分页信息 */}
          {!isSearching && currentTasks.length > 0 && (
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
    </div>
  );
}
