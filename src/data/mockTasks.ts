export interface TranscriptSegment {
  id: string;
  speaker: string;
  startTime: string;
  endTime: string;
  content: string;
  avatarColor: string;
}

export interface KeyPoint {
  text: string;
  timeReference: string;
}

export interface ActionItem {
  id: string;
  task: string;
  assignee: string;
  deadline: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  type: 'video' | 'audio' | 'file';
  fileType?: 'video' | 'audio' | 'file';
  status: 'processing' | 'completed' | 'failed';
  progress?: number;
  failureReason?: string;
  duration: string;
  timeAgo: string;
  transcript: TranscriptSegment[];
  keyPoints: KeyPoint[];
  actionItems: ActionItem[];
  createdAt?: string;
  updatedAt?: string;
}

export const mockTasks: Task[] = [
  {
    id: '1',
    title: '产品周会 2024-12-17',
    type: 'file',
    status: 'completed',
    duration: '45分钟',
    timeAgo: '2小时前',
    transcript: [
      {
        id: '1',
        speaker: '张三',
        startTime: '00:00',
        endTime: '00:45',
        content: '大家好，今天我们来讨论一下Q4的产品规划主要有三个议题需要确认。首先是用户增长目标的调整，其次是新功能的优先级排序，最后是技术债务的处理计划。',
        avatarColor: '#3B82F6'
      },
      {
        id: '2',
        speaker: '李四',
        startTime: '00:45',
        endTime: '01:30',
        content: '关于用户增长目标,根据上个季度的数据分析我建议将 MAU 目标从30万调整到 50万。这是基于我们最近的增长趋势和市场反馈得出的结论。',
        avatarColor: '#10B981'
      },
      {
        id: '3',
        speaker: '张三',
        startTime: '01:30',
        endTime: '02:15',
        content: '非常好的建议。那关于新功能的优先级,我们需要在 A、B、C 三个功能中做出选择。从用户需求的角度来看,我倾向于按照A > B > C 的顺序来推进。',
        avatarColor: '#3B82F6'
      },
      {
        id: '4',
        speaker: '王五',
        startTime: '02:15',
        endTime: '03:00',
        content: '从技术实现的角度补充一下功能 A 的技术难度相对较低可以快速上线。功能B需要重构部分底层架构建议放在第二优先级。功能C涉及到的技术债务比较多需要先做一些准备工作。',
        avatarColor: '#F59E0B'
      },
      {
        id: '5',
        speaker: '张三',
        startTime: '03:00',
        endTime: '03:30',
        content: '好的,那我们就按照这个优先级来推进。关于技术债务,王五你能详细说明一下需要处理哪些方面吗?',
        avatarColor: '#3B82F6'
      },
      {
        id: '6',
        speaker: '王五',
        startTime: '03:30',
        endTime: '04:15',
        content: '主要有三个方面一是数据库索引优化,二是缓存策略改进,三是API性能提升。这些技术债务如果不及时处理会影响到后续功能的开发效率。我建议将这些工作纳入到下个 Sprint 的规划中。',
        avatarColor: '#F59E0B'
      }
    ],
    keyPoints: [
      {
        text: '用户增长目标调整至 50 万 MAU',
        timeReference: '00:45'
      },
      {
        text: '新功能优先级排序:A > B > C',
        timeReference: '01:30'
      },
      {
        text: '技术债务处理计划启动',
        timeReference: '03:30'
      },
      {
        text: '数据库索引优化纳入下个Sprint',
        timeReference: '03:30'
      }
    ],
    actionItems: [
      {
        id: '1',
        task: '完成 PRD 文档',
        assignee: '张三',
        deadline: '12/20',
        completed: false
      },
      {
        id: '2',
        task: '技术方案评审',
        assignee: '李四',
        deadline: '12/22',
        completed: false
      },
      {
        id: '3',
        task: '设计稿交付',
        assignee: '王五',
        deadline: '12/25',
        completed: false
      },
      {
        id: '4',
        task: '数据库优化方案',
        assignee: '王五',
        deadline: '12/27',
        completed: false
      }
    ]
  },
  {
    id: '2',
    title: '技术分享录音',
    type: 'audio',
    status: 'processing',
    duration: '1小时',
    timeAgo: '5小时前',
    transcript: [],
    keyPoints: [],
    actionItems: []
  },
  {
    id: '3',
    title: 'YouTube: React 教程',
    type: 'video',
    status: 'failed',
    failureReason: '转写服务暂时不可用',
    duration: '30分钟',
    timeAgo: '昨天',
    transcript: [],
    keyPoints: [],
    actionItems: []
  }
];

// Helper function to get task by ID
export function getTaskById(id: string): Task | undefined {
  return mockTasks.find(task => task.id === id);
}

export function getStoredTasks(): Task[] {
  if (typeof window === 'undefined') return [];
  const raw = sessionStorage.getItem('mockTasks');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Task[]) : [];
  } catch {
    return [];
  }
}

export function upsertStoredTask(task: Task): void {
  if (typeof window === 'undefined') return;
  const stored = getStoredTasks();
  const next = [task, ...stored.filter((item) => item.id !== task.id)];
  sessionStorage.setItem('mockTasks', JSON.stringify(next));
}

export function updateStoredTask(id: string, updates: Partial<Task>): Task | null {
  if (typeof window === 'undefined') return null;
  const stored = getStoredTasks();
  const existing = stored.find((item) => item.id === id);
  if (!existing) return null;
  const updated = { ...existing, ...updates };
  const next = [updated, ...stored.filter((item) => item.id !== id)];
  sessionStorage.setItem('mockTasks', JSON.stringify(next));
  return updated;
}
