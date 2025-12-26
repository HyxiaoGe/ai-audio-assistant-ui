import type { Task } from "@/types"

export const mockTasks: Task[] = [
  {
    id: "1",
    title: "产品周会 2024-12-17",
    duration: 2730,
    status: "completed",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    fileType: "audio",
    fileSize: 42.5 * 1024 * 1024,
    transcript: [
      {
        id: "t1",
        speaker: "张三",
        startTime: 0,
        endTime: 45,
        text:
          "大家好，今天我们来讨论一下 Q4 的产品规划，主要有三个议题需要确认。首先是用户增长目标的调整，其次是新功能的优先级排序，最后是技术债务的处理计划。",
      },
      {
        id: "t2",
        speaker: "李四",
        startTime: 45,
        endTime: 90,
        text:
          "关于用户增长目标，基于最近的增长趋势和市场反馈，我建议将 MAU 目标从 30 万调整到 50 万。",
      },
      {
        id: "t3",
        speaker: "王五",
        startTime: 90,
        endTime: 135,
        text:
          "从技术角度看，功能 A 的实现成本较低，可以优先落地，功能 B 需要部分重构，功能 C 的技术债务较多。",
      },
    ],
    summary: {
      overview:
        "本次产品周会围绕 Q4 产品规划展开，重点确认了用户增长目标与新功能优先级，并讨论了技术债务处理方案。",
      keyPoints: [
        "Q4 用户增长目标调整至 50 万 MAU",
        "新功能优先级为 A > B > C",
        "技术债务纳入 Sprint 计划",
      ],
      actionItems: [
        "产品经理整理详细需求文档",
        "技术团队评估开发周期",
        "设计师准备 UI 原型",
      ],
    },
  },
  {
    id: "2",
    title: "技术分享录音",
    duration: 3600,
    status: "processing",
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    updatedAt: new Date(),
    fileType: "audio",
    progress: 65,
  },
  {
    id: "3",
    title: "YouTube: React 教程",
    duration: 1800,
    status: "completed",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 23 * 60 * 60 * 1000),
    fileType: "youtube",
  },
]
