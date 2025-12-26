"use client";

import { useEffect, useState } from "react";
import EmptyState from "@/components/common/EmptyState";
import TaskCard from "@/components/task/TaskCard";
import { getStoredTasks, mockTasks, Task } from "@/data/mockTasks";

export const RecentTasks = () => {
  const [tasks, setTasks] = useState<Task[]>(mockTasks);

  useEffect(() => {
    const stored = getStoredTasks();
    if (stored.length) {
      const merged = [...stored, ...mockTasks].filter(
        (task, index, list) => list.findIndex((item) => item.id === task.id) === index
      );
      setTasks(merged);
    }
  }, []);

  const recentTasks = tasks.slice(0, 5);

  if (recentTasks.length === 0) {
    return (
      <EmptyState
        title="暂无任务"
        description="上传音视频文件或粘贴链接，开始你的第一个任务"
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
          duration={task.duration}
          timeAgo={task.timeAgo}
          status={task.status}
          type={task.type}
        />
      ))}
    </div>
  );
};
