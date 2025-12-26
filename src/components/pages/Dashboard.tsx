"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import NewTaskCard from '@/components/task/NewTaskCard';
import TaskCard from '@/components/task/TaskCard';
import EmptyState from '@/components/common/EmptyState';
import { getStoredTasks, mockTasks, Task } from '@/data/mockTasks';
import { getTheme } from '@/styles/theme-config';

interface DashboardProps {
  isAuthenticated: boolean;
  onLogout: () => void;
  onOpenLogin: () => void;
  onOpenNewTask?: () => void;
  language?: 'zh' | 'en';
  theme?: 'light' | 'dark';
  onToggleLanguage?: () => void;
  onToggleTheme?: () => void;
}

export default function Dashboard({ 
  isAuthenticated, 
  onLogout, 
  onOpenLogin,
  onOpenNewTask,
  language = 'zh',
  theme = 'light',
  onToggleLanguage = () => {},
  onToggleTheme = () => {}
}: DashboardProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const colors = getTheme(theme);

  useEffect(() => {
    const stored = getStoredTasks();
    if (stored.length) {
      const merged = [...stored, ...mockTasks].filter(
        (task, index, list) => list.findIndex((item) => item.id === task.id) === index
      );
      setTasks(merged);
    }
  }, []);

  const handleNewTask = () => {
    if (!isAuthenticated) {
      onOpenLogin();
    } else {
      if (onOpenNewTask) {
        onOpenNewTask();
      } else {
        router.push('/new-task');
      }
    }
  };

  const handleTaskClick = (taskId: string) => {
    router.push(`/tasks/${taskId}`);
  };

  // 获取最近任务（最多5个）
  const recentTasks = tasks.slice(0, 5);
  const hasNoTasks = tasks.length === 0;

  return (
    <div className="h-screen flex flex-col" style={{ background: colors.bg.primary }}>
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
        <Sidebar theme={theme} />

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto p-8" style={{ background: colors.bg.primary }}>
          {/* 欢迎区域 */}
          <div className="mb-8">
            <h2 
              className="text-h2"
              style={{ color: colors.text.primary }}
            >
              欢迎回来，Sean 👋
            </h2>
          </div>

          {/* 新建任务卡片 */}
          <div className="mb-8">
            <NewTaskCard onClick={handleNewTask} theme={theme} />
          </div>

          {/* 最近任务 */}
          <div>
            <h3 
              className="text-h3 mb-4"
              style={{ color: colors.text.primary }}
            >
              最近任务
            </h3>

            {/* 任务列表 */}
            <div className="space-y-3">
              {hasNoTasks ? (
                <EmptyState 
                  variant="default"
                  title="暂无任务"
                  description="上传音视频文件或粘贴链接，开始你的第一个任务"
                  action={{
                    label: '+ 创建任务',
                    onClick: handleNewTask,
                    variant: 'primary'
                  }}
                  theme={theme}
                />
              ) : (
                recentTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    id={task.id}
                    title={task.title}
                    duration={task.duration}
                    timeAgo={task.timeAgo}
                    status={task.status}
                    type={task.type}
                    onClick={() => handleTaskClick(task.id)}
                    theme={theme}
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
