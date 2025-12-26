"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, ChevronDown, FileText, CheckSquare, Lightbulb } from 'lucide-react';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import PlayerBar from '@/components/task/PlayerBar';
import TranscriptItem from '@/components/task/TranscriptItem';
import TabSwitch from '@/components/task/TabSwitch';
import ProcessingState from '@/components/common/ProcessingState';
import ErrorState from '@/components/common/ErrorState';
import { getStoredTasks, getTaskById, Task, updateStoredTask, upsertStoredTask } from '@/data/mockTasks';

interface TaskDetailProps {
  language?: 'zh' | 'en';
  theme?: 'light' | 'dark';
  onToggleLanguage?: () => void;
  onToggleTheme?: () => void;
  isProcessing?: boolean;
}

interface TranscriptSegment {
  id: string;
  speaker: string;
  startTime: string;
  endTime: string;
  content: string;
  avatarColor: string;
}

interface KeyPoint {
  text: string;
  timeReference: string;
}

interface ActionItem {
  id: string;
  task: string;
  assignee: string;
  deadline: string;
  completed: boolean;
}

interface Speaker {
  name: string;
  color: string;
}

// Available speakers for the meeting
const availableSpeakers: Speaker[] = [
  { name: '张三', color: '#3B82F6' },
  { name: '李四', color: '#10B981' },
  { name: '王五', color: '#F59E0B' },
  { name: '赵六', color: '#EF4444' },
  { name: '钱七', color: '#8B5CF6' },
  { name: '未知', color: '#94A3B8' }
];

export default function TaskDetail({
  language = 'zh',
  theme = 'light',
  onToggleLanguage = () => {},
  onToggleTheme = () => {},
  isProcessing = false
}: TaskDetailProps) {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeTab, setActiveTab] = useState('summary');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [progress, setProgress] = useState(0);

  const duration = 2730; // 45:30 in seconds

  const [task, setTask] = useState<Task | null>(null);
  const [localStatus, setLocalStatus] = useState<'processing' | 'completed' | 'failed'>('completed');
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const isProcessingTask = localStatus === 'processing';

  useEffect(() => {
    if (!id) return;
    const stored = getStoredTasks();
    const storedTask = stored.find((item) => item.id === id);
    const baseTask = storedTask ?? getTaskById(id as string);
    setTask(baseTask ?? null);
    if (baseTask) {
      setLocalStatus(baseTask.status);
      if (baseTask.status === 'processing') {
        setProgress(baseTask.progress ?? 0);
      }
    }
  }, [id]);

  useEffect(() => {
    if (!isProcessingTask) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = Math.min(prev + 5, 100);
        if (next >= 100) {
          clearInterval(interval);
          timeoutId = setTimeout(() => {
            setLocalStatus('completed');
            const now = new Date().toISOString();
            const updated = updateStoredTask(id, { status: 'completed', progress: 100, updatedAt: now });
            if (task && !updated) {
              upsertStoredTask({ ...task, status: 'completed', progress: 100, updatedAt: now });
            }
          }, 1000);
        }
        return next;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isProcessingTask]);

  useEffect(() => {
    if (!task) return;
    setTranscript(task.transcript ?? []);
    setActionItems(task.actionItems ?? []);
  }, [task]);

  if (!task) {
    return (
      <div className="h-screen flex flex-col" style={{ background: '#FFFFFF' }}>
        <Header
          isAuthenticated={true}
          onOpenLogin={() => {}}
          language={language}
          theme={theme}
          onToggleLanguage={onToggleLanguage}
          onToggleTheme={onToggleTheme}
        />
        <div className="flex-1 flex items-center justify-center">
          <ErrorState
            type="general"
            title="任务未找到"
            description="该任务不存在或已被删除"
            onRetry={() => router.push('/')}
            retryLabel="返回首页"
          />
        </div>
      </div>
    );
  }

  const getEstimatedTime = () => {
    const remaining = 100 - progress;
    const minutes = Math.ceil((remaining / 100) * 5);
    return `约 ${minutes} 分钟`;
  };

  const getCurrentStep = () => {
    if (progress < 10) return 1;
    if (progress < 60) return 2;
    if (progress < 90) return 3;
    if (progress < 100) return 4;
    return 5;
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time: number) => {
    setCurrentTime(time);
  };

  const handleTimeClick = (time: string) => {
    // Convert time string to seconds
    const [mins, secs] = time.split(':').map(Number);
    const totalSeconds = mins * 60 + secs;
    setCurrentTime(totalSeconds);
  };

  const handleEditTranscript = (segmentId: string, newContent: string) => {
    setTranscript(prev =>
      prev.map(segment =>
        segment.id === segmentId ? { ...segment, content: newContent } : segment
      )
    );
  };

  const handleSpeakerChange = (segmentId: string, newSpeaker: string, newColor: string) => {
    setTranscript(prev =>
      prev.map(segment =>
        segment.id === segmentId 
          ? { ...segment, speaker: newSpeaker, avatarColor: newColor } 
          : segment
      )
    );
  };

  const toggleActionItem = (itemId: string) => {
    setActionItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const summaryTabs = [
    { id: 'summary', label: '摘要' },
    { id: 'keypoints', label: '要点' },
    { id: 'actions', label: '待办' }
  ];

  const mockKeyPoints: KeyPoint[] = task.keyPoints ?? [];

  if (localStatus === 'failed') {
    return (
      <div className="h-screen flex flex-col" style={{ background: '#FFFFFF' }}>
        {/* Header */}
        <Header
          isAuthenticated={true}
          onOpenLogin={() => {}}
          language={language}
          theme={theme}
          onToggleLanguage={onToggleLanguage}
          onToggleTheme={onToggleTheme}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <Sidebar />

          {/* Page Content */}
          <main className="flex-1 flex flex-col overflow-hidden" style={{ background: '#FFFFFF' }}>
            {/* Title Bar */}
            <div
              className="flex items-center justify-between px-6 border-b"
              style={{ height: '64px', borderColor: '#E2E8F0' }}
            >
              {/* Left: Back Button */}
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                style={{ color: '#64748B' }}
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm" style={{ fontWeight: 500 }}>返回</span>
              </button>

              {/* Center: Title */}
              <h1 className="text-xl" style={{ fontWeight: 600, color: '#0F172A' }}>
                {task.title}
              </h1>

              {/* Right: Empty space for balance */}
              <div style={{ width: '100px' }}></div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
              <div
                className="w-full rounded-xl border p-10 text-center"
                style={{ maxWidth: '480px', borderColor: '#FECACA', background: '#FEF2F2' }}
              >
                <div className="flex justify-center mb-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ background: '#FEE2E2', color: '#EF4444' }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-xl mb-2" style={{ fontWeight: 600, color: '#B91C1C' }}>
                  处理失败
                </h2>
                <p className="text-sm mb-6" style={{ color: '#DC2626' }}>
                  {task.failureReason || '转写服务暂时不可用'}
                </p>
                <button
                  onClick={() => {
                    setProgress(0);
                    setLocalStatus('processing');
                    const now = new Date().toISOString();
                    const updated = updateStoredTask(id, { status: 'processing', progress: 0, updatedAt: now });
                    if (!updated) {
                      upsertStoredTask({ ...task, status: 'processing', progress: 0, updatedAt: now });
                    }
                  }}
                  className="px-6 py-2 rounded-lg text-sm transition-colors"
                  style={{ background: '#EF4444', color: '#FFFFFF' }}
                >
                  重试
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (isProcessingTask) {
    return (
      <div className="h-screen flex flex-col" style={{ background: '#FFFFFF' }}>
        {/* Header */}
        <Header
          isAuthenticated={true}
          onOpenLogin={() => {}}
          language={language}
          theme={theme}
          onToggleLanguage={onToggleLanguage}
          onToggleTheme={onToggleTheme}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <Sidebar />

          {/* Page Content */}
          <main 
            className="flex-1 flex flex-col overflow-hidden" 
            style={{ 
              background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)'
            }}
          >
            {/* Title Bar */}
            <div
              className="flex items-center justify-between px-6 border-b"
              style={{ 
                height: '64px', 
                borderColor: '#E2E8F0',
                background: '#FFFFFF'
              }}
            >
              {/* Left: Back Button */}
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                style={{ color: '#64748B' }}
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm" style={{ fontWeight: 500 }}>返回</span>
              </button>

              {/* Center: Title */}
              <h1 className="text-xl" style={{ fontWeight: 600, color: '#0F172A' }}>
                {task.title}
              </h1>

              {/* Right: Empty space for balance */}
              <div style={{ width: '100px' }}></div>
            </div>

            {/* Main Content with gradient background */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
              {/* 文件信息卡片 */}
              <div 
                className="w-full mb-6 p-4 rounded-lg border"
                style={{
                  maxWidth: '480px',
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(10px)',
                  borderColor: '#E2E8F0'
                }}
              >
                <div className="flex items-start gap-3">
                  <div 
                    className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: '#EFF6FF' }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2">
                      <path d="M9 18V5l12-2v13M9 13l12-2" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm truncate" style={{ fontWeight: 600, color: '#1E293B' }}>
                      产品周会录音.mp3
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs" style={{ color: '#94A3B8' }}>
                        42.5 MB
                      </span>
                      <span className="text-xs" style={{ color: '#CBD5E1' }}>·</span>
                      <span className="text-xs" style={{ color: '#94A3B8' }}>
                        45:30
                      </span>
                      <span className="text-xs" style={{ color: '#CBD5E1' }}>·</span>
                      <span className="text-xs" style={{ color: '#94A3B8' }}>
                        刚刚上传
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Processing State */}
              <ProcessingState
                progress={progress}
                currentStep={getCurrentStep()}
                estimatedTime={getEstimatedTime()}
              />

              {/* 底部提示信息 */}
              <div 
                className="w-full mt-6 text-center"
                style={{ maxWidth: '480px' }}
              >
                <div 
                  className="flex items-start gap-2 p-4 rounded-lg"
                  style={{ background: 'rgba(59, 130, 246, 0.05)' }}
                >
                  <svg 
                    className="flex-shrink-0 mt-0.5"
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="#3B82F6" 
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <p className="text-xs text-left" style={{ color: '#64748B', lineHeight: '1.5' }}>
                    处理期间可以关闭此页面，我们会保存您的进度。处理完成后您可以在任务列表中查看结果。
                  </p>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: '#FFFFFF' }}>
      {/* Header */}
      <Header
        isAuthenticated={true}
        onOpenLogin={() => {}}
        language={language}
        theme={theme}
        onToggleLanguage={onToggleLanguage}
        onToggleTheme={onToggleTheme}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Page Content */}
        <main className="flex-1 flex flex-col overflow-hidden" style={{ background: '#FFFFFF' }}>
          {/* Title Bar */}
          <div
            className="flex items-center justify-between px-6 border-b"
            style={{ height: '64px', borderColor: '#E2E8F0' }}
          >
            {/* Left: Back Button */}
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              style={{ color: '#64748B' }}
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm" style={{ fontWeight: 500 }}>返回</span>
            </button>

            {/* Center: Title */}
            <h1 className="text-xl" style={{ fontWeight: 600, color: '#0F172A' }}>
              {task.title}
            </h1>

            {/* Right: Export Button */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
                style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
              >
                <span className="text-sm" style={{ fontWeight: 500 }}>导出</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {showExportMenu && (
                <div
                  className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg border overflow-hidden z-10"
                  style={{ background: '#FFFFFF', borderColor: '#E2E8F0' }}
                >
                  <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50" style={{ color: '#0F172A' }}>
                    导出为 PDF
                  </button>
                  <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50" style={{ color: '#0F172A' }}>
                    导出为 Word
                  </button>
                  <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50" style={{ color: '#0F172A' }}>
                    导出为 Markdown
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Player Bar */}
          <div className="px-6 py-4" style={{ background: '#FFFFFF' }}>
            <PlayerBar
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              onSeek={handleSeek}
            />
          </div>

          {/* Two Column Layout */}
          <div className="flex-1 flex overflow-hidden border-t" style={{ borderColor: '#E2E8F0' }}>
            {/* Left Column: Transcript */}
            <div className="flex-1 flex flex-col border-r" style={{ borderColor: '#E2E8F0' }}>
              {/* Column Header */}
              <div className="flex items-center gap-2 px-4 py-4 border-b" style={{ borderColor: '#E2E8F0' }}>
                <FileText className="w-5 h-5" style={{ color: '#0F172A' }} />
                <h2 className="text-base" style={{ fontWeight: 600, color: '#0F172A' }}>
                  转写内容
                </h2>
              </div>

              {/* Transcript List */}
              <div className="flex-1 overflow-y-auto">
                {transcript.length > 0 ? (
                  transcript.map((segment) => (
                    <TranscriptItem
                      key={segment.id}
                      speaker={segment.speaker}
                      startTime={segment.startTime}
                      endTime={segment.endTime}
                      content={segment.content}
                      avatarColor={segment.avatarColor}
                      availableSpeakers={availableSpeakers}
                      onTimeClick={handleTimeClick}
                      onEdit={(newContent) => handleEditTranscript(segment.id, newContent)}
                      onSpeakerChange={(newSpeaker, newColor) => handleSpeakerChange(segment.id, newSpeaker, newColor)}
                    />
                  ))
                ) : (
                  <ErrorState
                    type="processing"
                    title="暂无转写内容"
                    description="任务处理失败，请重试"
                    onRetry={() => window.location.reload()}
                    retryLabel="重新处理"
                  />
                )}
              </div>
            </div>

            {/* Right Column: Summary Panel */}
            <div className="flex-1 flex flex-col" style={{ maxWidth: '50%' }}>
              {/* Tab Switch */}
              <div className="flex justify-center border-b" style={{ borderColor: '#E2E8F0' }}>
                <TabSwitch
                  tabs={summaryTabs}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                />
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Summary Tab */}
                {activeTab === 'summary' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg mb-2" style={{ fontWeight: 600, color: '#0F172A' }}>
                        会议概述
                      </h3>
                      <p className="text-base leading-7" style={{ color: '#0F172A' }}>
                        本次产品周会讨论了Q4产品规划,重点确定了用户增长目标和新功能优先级排序。与会人员包括产品、技术、设计三方代表。
                      </p>
                    </div>

                    <div>
                      <h3 className="text-lg mb-2" style={{ fontWeight: 600, color: '#0F172A' }}>
                        主要结论
                      </h3>
                      <ol className="space-y-2 text-base leading-7" style={{ color: '#0F172A' }}>
                        <li>1. Q4 用户增长目标调整至 50 万 MAU</li>
                        <li>2. 新功能按 A &gt; B &gt; C 优先级排序</li>
                        <li>3. 技术债务纳入 Sprint 计划</li>
                      </ol>
                    </div>
                  </div>
                )}

                {/* Key Points Tab */}
                {activeTab === 'keypoints' && (
                  <div className="space-y-4">
                    {mockKeyPoints.map((point, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          <Lightbulb className="w-5 h-5" style={{ color: '#F59E0B' }} />
                        </div>
                        <div className="flex-1">
                          <p className="text-base mb-1" style={{ color: '#0F172A' }}>
                            {point.text}
                          </p>
                          <button
                            onClick={() => handleTimeClick(point.timeReference)}
                            className="text-sm hover:underline"
                            style={{ color: '#3B82F6' }}
                          >
                            ↗{point.timeReference} 详细讨论
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action Items Tab */}
                {activeTab === 'actions' && (
                  <div className="space-y-4">
                    {actionItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 p-3 rounded-lg border transition-colors"
                        style={{
                          borderColor: '#E2E8F0',
                          background: item.completed ? '#F8FAFC' : '#FFFFFF'
                        }}
                      >
                        <button
                          onClick={() => toggleActionItem(item.id)}
                          className="flex-shrink-0 mt-0.5"
                        >
                          {item.completed ? (
                            <CheckSquare className="w-5 h-5" style={{ color: '#10B981' }} />
                          ) : (
                            <div
                              className="w-5 h-5 border-2 rounded"
                              style={{ borderColor: '#E2E8F0' }}
                            />
                          )}
                        </button>
                        <div className="flex-1">
                          <p
                            className="text-base mb-1"
                            style={{
                              color: item.completed ? '#94A3B8' : '#0F172A',
                              textDecoration: item.completed ? 'line-through' : 'none'
                            }}
                          >
                            {item.task}
                          </p>
                          <div className="flex items-center gap-2 text-sm" style={{ color: '#64748B' }}>
                            <span>@{item.assignee}</span>
                            <span>·</span>
                            <span>截止 {item.deadline}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
