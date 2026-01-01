/**
 * 任务列表组件（API 版本）
 * 从后端 API 获取真实数据
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Search, ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TaskCardNew } from "./TaskCardNew"
import { StatusFilter } from "./StatusFilter"
import EmptyState from "@/components/common/EmptyState"
import { useAPIClient } from "@/lib/use-api-client"
import { notifyError, notifySuccess } from "@/lib/notify"
import type { TaskListItem, TaskStatus } from "@/types/api"
import { ApiError } from "@/types/api"
import { useI18n } from "@/lib/i18n-context"

const TASKS_PER_PAGE = 20

interface TaskListAPIProps {
  onRequireLogin?: () => void
}

export function TaskListAPI({ onRequireLogin }: TaskListAPIProps) {
  const router = useRouter()
  const client = useAPIClient()
  const { data: session, status } = useSession()
  const { t } = useI18n()

  // 状态
  const [tasks, setTasks] = useState<TaskListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 筛选
  const [filterStatus, setFilterStatus] = useState<"all" | TaskStatus>("all")
  const [searchQuery, setSearchQuery] = useState("")

  // 分页
  const [currentPage, setCurrentPage] = useState(1)
  const [totalTasks, setTotalTasks] = useState(0)
  const [retryingTaskId, setRetryingTaskId] = useState<string | null>(null)

  /**
   * 加载任务列表
   */
  const loadTasks = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await client.getTasks({
        page: currentPage,
        page_size: TASKS_PER_PAGE,
        status: filterStatus,
      })

      setTasks(result.items)
      setTotalTasks(result.total)
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : t("errors.loadTaskFailed")
      setError(errorMsg)
      notifyError(errorMsg)
    } finally {
      setLoading(false)
    }
  }, [client, currentPage, filterStatus, t])

  /**
   * 初始加载
   */
  useEffect(() => {
    if (session?.user) {
      loadTasks()
    }
  }, [loadTasks, session])

  if (status === "loading") {
    return (
      <div className="flex justify-center py-12">
        <div className="text-center">
          <div
            className="inline-block size-8 border-4 border-[var(--app-primary)] border-t-transparent rounded-full animate-spin"
            style={{ borderColor: "var(--app-primary) transparent var(--app-primary) var(--app-primary)" }}
          />
          <p className="mt-4 text-sm" style={{ color: "var(--app-text-muted)" }}>
            {t("common.loading")}...
          </p>
        </div>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div
        className="glass-panel p-10 rounded-lg text-center"
      >
        <h2 className="text-2xl font-semibold" style={{ color: "var(--app-text)" }}>
          {t("tasks.loginToViewTitle")}
        </h2>
        <p className="mt-2 text-sm" style={{ color: "var(--app-text-muted)" }}>
          {t("tasks.loginToViewDescription")}
        </p>
        <div className="mt-6 flex justify-center">
          <Button onClick={() => onRequireLogin?.()}>{t("dashboard.goLogin")}</Button>
        </div>
      </div>
    )
  }

  /**
   * 状态筛选变化
   */
  const handleStatusChange = (status: "all" | TaskStatus) => {
    setFilterStatus(status)
    setCurrentPage(1) // 重置到第一页
  }

  /**
   * 搜索（客户端过滤）
   */
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
  }

  /**
   * 分页变化
   */
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  /**
   * 点击任务卡片
   */
  const handleTaskClick = (taskId: string) => {
    router.push(`/tasks/${taskId}`)
  }

  const handleRetryTask = async (taskId: string) => {
    if (retryingTaskId) return

    setRetryingTaskId(taskId)
    try {
      const result = await client.retryTask(taskId, false)
      if ("action" in result && result.action === "duplicate_found") {
        const duplicateId = result.duplicate_task_id
        if (!duplicateId) {
          notifyError(t("task.retryFailed"))
          return
        }

        const failedIds = result.failed_task_ids || []
        if (failedIds.length > 0 && typeof window !== "undefined") {
          const storageKey = `task-cleanup:${duplicateId}`
          window.sessionStorage.setItem(
            storageKey,
            JSON.stringify({ failedTaskIds: failedIds, savedAt: Date.now() })
          )
        }

        router.push(`/tasks/${duplicateId}`)
        return
      }

      notifySuccess(t("task.retrySuccess"))
      await loadTasks()
    } catch (err) {
      if (err instanceof ApiError) {
        notifyError(err.message)
      } else {
        notifyError(t("task.retryFailed"))
      }
    } finally {
      setRetryingTaskId(null)
    }
  }

  // 客户端搜索过滤
  const filteredTasks = searchQuery
    ? tasks.filter((task) =>
        task.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tasks

  // 计算总页数
  const totalPages = Math.ceil(totalTasks / TASKS_PER_PAGE)

  // 计算状态数量（需要全量数据，这里简化处理）
  const statusCounts = {
    all: totalTasks,
    pending: tasks.filter((t) => t.status === "pending").length,
    extracting: tasks.filter((t) => t.status === "extracting").length,
    transcribing: tasks.filter((t) => t.status === "transcribing").length,
    summarizing: tasks.filter((t) => t.status === "summarizing").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    failed: tasks.filter((t) => t.status === "failed").length,
  }

  const getStatusLabel = (statusValue: "all" | TaskStatus): string => {
    if (statusValue === "all") return ""
    return t(`task.status.${statusValue}`)
  }

  return (
    <div className="space-y-6">
      {/* 标题区域 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold" style={{ color: "var(--app-text)" }}>
            {t("tasks.pageTitle")}
          </h2>
          <p className="text-base mt-2" style={{ color: "var(--app-text-muted)" }}>
            {t("tasks.pageSubtitle")}
          </p>
        </div>

        {/* 新建任务按钮 */}
        <Button
          onClick={() => router.push("/tasks/new")}
          size="lg"
          className="gap-2"
        >
          <Plus className="size-5" />
          {t("task.newTask")}
        </Button>
      </div>

      {/* 状态筛选 */}
      <StatusFilter
        value={filterStatus}
        onChange={handleStatusChange}
        counts={statusCounts}
      />

      {/* 搜索框 */}
      <div className="relative max-w-md">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <Search className="size-5" style={{ color: "var(--app-text-subtle)" }} />
        </div>
        <input
          type="text"
          placeholder={t("tasks.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="glass-control w-full pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--app-primary)]"
          style={{ color: "var(--app-text)" }}
        />
        {searchQuery && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <button
              onClick={() => handleSearchChange("")}
              className="glass-chip text-xs px-2 py-1 rounded"
              style={{ color: "var(--app-text-subtle)" }}
            >
              {t("tasks.clearSearch")}
            </button>
          </div>
        )}
      </div>

      {searchQuery && (
        <p className="text-sm" style={{ color: "var(--app-text-muted)" }}>
          {t("tasks.searchResults", { count: filteredTasks.length })}
        </p>
      )}

      {/* 加载状态 */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="text-center">
            <div
              className="inline-block size-8 border-4 border-[var(--app-primary)] border-t-transparent rounded-full animate-spin"
              style={{ borderColor: "var(--app-primary) transparent var(--app-primary) var(--app-primary)" }}
            />
            <p className="mt-4 text-sm" style={{ color: "var(--app-text-muted)" }}>
              {t("common.loading")}...
            </p>
          </div>
        </div>
      )}

      {/* 错误状态 */}
      {error && !loading && (
        <div
          className="p-4 rounded-lg text-sm"
          style={{
            backgroundColor: "var(--app-danger-bg-soft)",
            color: "var(--app-danger)",
          }}
        >
          {error}
          <Button
            variant="secondary"
            size="sm"
            className="ml-4"
            onClick={loadTasks}
          >
            {t("common.retry")}
          </Button>
        </div>
      )}

      {/* 任务列表 */}
      {!loading && !error && (
        <>
          {filteredTasks.length > 0 ? (
            <div className="space-y-3">
              {filteredTasks.map((task) => (
                <TaskCardNew
                  key={task.id}
                  task={task}
                  onClick={() => handleTaskClick(task.id)}
                  onRetry={() => handleRetryTask(task.id)}
                  isRetrying={retryingTaskId === task.id}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              variant={searchQuery ? "search" : "default"}
              title={
                searchQuery
                  ? t("tasks.noResultTitle")
                  : filterStatus === "all"
                    ? t("tasks.noTaskTitleAll")
                    : t("tasks.noTaskTitle", { status: getStatusLabel(filterStatus) })
              }
              description={
                searchQuery
                  ? t("tasks.noResultDescription")
                  : t("tasks.noTaskDescriptionAll")
              }
              action={{
                label: searchQuery ? t("tasks.clearSearch") : t("dashboard.createTask"),
                onClick: searchQuery
                  ? () => setSearchQuery("")
                  : () => router.push("/tasks/new"),
                variant: searchQuery ? "secondary" : "primary",
              }}
            />
          )}

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="glass-chip flex items-center justify-center size-9 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="size-4" />
              </button>

              {/* 页码显示 */}
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => {
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
                      )
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
                      )
                    }
                    return null
                  }
                )}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="glass-chip flex items-center justify-center size-9 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}

          {/* 分页信息 */}
          {filteredTasks.length > 0 && (
            <div className="text-center mt-4">
              <p className="text-sm" style={{ color: "var(--app-text-subtle)" }}>
                {t("tasks.pagination", {
                  from: (currentPage - 1) * TASKS_PER_PAGE + 1,
                  to: Math.min(currentPage * TASKS_PER_PAGE, totalTasks),
                  total: totalTasks
                })}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
