"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import TaskCard from '@/components/task/TaskCard';
import EmptyState from '@/components/common/EmptyState';
import { getStoredTasks, mockTasks, Task } from '@/data/mockTasks';

interface TaskListProps {
  isAuthenticated: boolean;
  onLogout: () => void;
  onOpenLogin: () => void;
  language?: 'zh' | 'en';
  theme?: 'light' | 'dark';
  onToggleLanguage?: () => void;
  onToggleTheme?: () => void;
}

export default function TaskList({
  isAuthenticated,
  onLogout,
  onOpenLogin,
  language = 'zh',
  theme = 'light',
  onToggleLanguage = () => {},
  onToggleTheme = () => {}
}: TaskListProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [filterStatus, setFilterStatus] = useState<'all' | 'processing' | 'completed' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const tasksPerPage = 10;

  useEffect(() => {
    const stored = getStoredTasks();
    if (stored.length) {
      const merged = [...stored, ...mockTasks].filter(
        (task, index, list) => list.findIndex((item) => item.id === task.id) === index
      );
      setTasks(merged);
    }
  }, []);

  const handleTaskClick = (taskId: string) => {
    router.push(`/tasks/${taskId}`);
  };

  // 先按状态筛选
  const statusFilteredTasks = tasks.filter(task => {
    if (filterStatus === 'all') return true;
    return task.status === filterStatus;
  });

  // 再按搜索关键词筛选
  const filteredTasks = statusFilteredTasks.filter(task => {
    if (!searchQuery.trim()) return true;
    return task.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // 计算分页
  const totalPages = Math.ceil(filteredTasks.length / tasksPerPage);
  const startIndex = (currentPage - 1) * tasksPerPage;
  const endIndex = startIndex + tasksPerPage;
  const currentTasks = filteredTasks.slice(startIndex, endIndex);

  // 状态统计（基于搜索结果）
  const statusCounts = {
    all: tasks.length,
    processing: tasks.filter(t => t.status === 'processing').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length
  };

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

  return (
    <div className="h-screen flex flex-col" style={{ background: '#FFFFFF' }}>
      {/* Header */}
      <Header
        isAuthenticated={isAuthenticated}
        onOpenLogin={onOpenLogin}
        language={language}
        theme={theme}
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
              style={{ color: '#0F172A' }}
            >
              所有任务
            </h2>
            <p className="text-base mt-2" style={{ color: '#64748B' }}>
              管理和查看你的所有音视频处理任务
            </p>
          </div>

          {/* 筛选器 */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => handleStatusChange('all')}
              className="px-4 py-2 rounded-lg text-sm transition-all"
              style={{
                background: filterStatus === 'all' ? '#3B82F6' : '#F8FAFC',
                color: filterStatus === 'all' ? '#FFFFFF' : '#64748B',
                fontWeight: filterStatus === 'all' ? 500 : 400
              }}
            >
              全部 ({statusCounts.all})
            </button>
            <button
              onClick={() => handleStatusChange('processing')}
              className="px-4 py-2 rounded-lg text-sm transition-all"
              style={{
                background: filterStatus === 'processing' ? '#3B82F6' : '#F8FAFC',
                color: filterStatus === 'processing' ? '#FFFFFF' : '#64748B',
                fontWeight: filterStatus === 'processing' ? 500 : 400
              }}
            >
              处理中 ({statusCounts.processing})
            </button>
            <button
              onClick={() => handleStatusChange('completed')}
              className="px-4 py-2 rounded-lg text-sm transition-all"
              style={{
                background: filterStatus === 'completed' ? '#3B82F6' : '#F8FAFC',
                color: filterStatus === 'completed' ? '#FFFFFF' : '#64748B',
                fontWeight: filterStatus === 'completed' ? 500 : 400
              }}
            >
              已完成 ({statusCounts.completed})
            </button>
            <button
              onClick={() => handleStatusChange('failed')}
              className="px-4 py-2 rounded-lg text-sm transition-all"
              style={{
                background: filterStatus === 'failed' ? '#3B82F6' : '#F8FAFC',
                color: filterStatus === 'failed' ? '#FFFFFF' : '#64748B',
                fontWeight: filterStatus === 'failed' ? 500 : 400
              }}
            >
              失败 ({statusCounts.failed})
            </button>
          </div>

          {/* 搜索框 */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <Search className="w-5 h-5" style={{ color: '#94A3B8' }} />
              </div>
              <input
                type="text"
                placeholder="搜索任务标题..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border transition-colors text-sm"
                style={{
                  borderColor: searchQuery ? '#3B82F6' : '#E2E8F0',
                  color: '#0F172A'
                }}
              />
              {searchQuery && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <button
                    onClick={() => handleSearchChange('')}
                    className="text-xs px-2 py-1 rounded hover:bg-gray-100"
                    style={{ color: '#94A3B8' }}
                  >
                    清除
                  </button>
                </div>
              )}
            </div>
            {searchQuery && (
              <p className="mt-2 text-sm" style={{ color: '#64748B' }}>
                找到 {filteredTasks.length} 个结果
              </p>
            )}
          </div>

          {/* 任务列表 */}
          <div className="space-y-3">
            {currentTasks.length > 0 ? (
              currentTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  id={task.id}
                  title={task.title}
                  duration={task.duration}
                  timeAgo={task.timeAgo}
                  status={task.status}
                  type={task.type}
                  onClick={() => handleTaskClick(task.id)}
                />
              ))
            ) : (
              // 空状态：区分搜索无结果和真的没有任务
              searchQuery ? (
                <EmptyState
                  variant="search"
                  title="没有找到任务"
                  description="尝试调整筛选条件或搜索关键词"
                  action={{
                    label: '清除筛选',
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
                  title={`暂无${filterStatus === 'all' ? '' : getStatusText(filterStatus)}任务`}
                  description={filterStatus === 'all' ? '创建新任务开始使用' : '切换其他筛选条件查看'}
                  action={filterStatus === 'all' ? {
                    label: '+ 创建任务',
                    onClick: () => router.push('/new-task'),
                    variant: 'primary'
                  } : {
                    label: '查看全部',
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
                className="flex items-center justify-center w-9 h-9 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: currentPage > 1 ? '#F8FAFC' : '#F8FAFC',
                  color: '#64748B',
                  border: '1px solid #E2E8F0'
                }}
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
                        className="flex items-center justify-center min-w-9 h-9 px-3 rounded-lg text-sm transition-all"
                        style={{
                          background: page === currentPage ? '#3B82F6' : '#F8FAFC',
                          color: page === currentPage ? '#FFFFFF' : '#64748B',
                          fontWeight: page === currentPage ? 500 : 400,
                          border: page === currentPage ? 'none' : '1px solid #E2E8F0'
                        }}
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
                        style={{ color: '#94A3B8' }}
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
                className="flex items-center justify-center w-9 h-9 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: currentPage < totalPages ? '#F8FAFC' : '#F8FAFC',
                  color: '#64748B',
                  border: '1px solid #E2E8F0'
                }}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 分页信息 */}
          {filteredTasks.length > 0 && (
            <div className="text-center mt-4">
              <p className="text-sm" style={{ color: '#94A3B8' }}>
                显示 {startIndex + 1}-{Math.min(endIndex, filteredTasks.length)} 条，共 {filteredTasks.length} 条
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function getStatusText(status: string): string {
  switch (status) {
    case 'processing':
      return '处理中';
    case 'completed':
      return '已完成';
    case 'failed':
      return '失败';
    default:
      return '';
  }
}
