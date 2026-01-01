"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { notifyError, notifySuccess } from '@/lib/notify';
import { ArrowLeft, ChevronDown, FileText, CheckSquare, Lightbulb } from 'lucide-react';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import PlayerBar from '@/components/task/PlayerBar';
import TranscriptItem from '@/components/task/TranscriptItem';
import TabSwitch from '@/components/task/TabSwitch';
import ProcessingState from '@/components/common/ProcessingState';
import ErrorState from '@/components/common/ErrorState';
import LoginModal from '@/components/auth/LoginModal';
import RetryCleanupToast from '@/components/task/RetryCleanupToast';
import { useAPIClient } from '@/lib/use-api-client';
import { useGlobalStore } from '@/store/global-store';
import { ApiError } from '@/types/api';
import type { TaskDetail as ApiTaskDetail, TranscriptSegment as ApiTranscriptSegment, SummaryItem } from '@/types/api';
import { useI18n } from '@/lib/i18n-context';

interface TaskDetailProps {
  language?: 'zh' | 'en';
  onToggleLanguage?: () => void;
  onToggleTheme?: () => void;
}

interface DisplayTranscriptSegment {
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

export default function TaskDetail({
  language = 'zh',
  onToggleLanguage = () => {},
  onToggleTheme = () => {}
}: TaskDetailProps) {
  const router = useRouter();
  const params = useParams();
  const { data: session, status: sessionStatus } = useSession();
  const client = useAPIClient();
  const { t } = useI18n();
  const id = params?.id as string;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [activeTab, setActiveTab] = useState('summary');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loginOpen, setLoginOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showCleanupToast, setShowCleanupToast] = useState(false);
  const [failedTaskIds, setFailedTaskIds] = useState<string[]>([]);
  const [isCleaning, setIsCleaning] = useState(false);

  const [task, setTask] = useState<ApiTaskDetail | null>(null);
  const [transcript, setTranscript] = useState<DisplayTranscriptSegment[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [keyPoints, setKeyPoints] = useState<KeyPoint[]>([]);
  const [summaryOverview, setSummaryOverview] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isProcessingTask = task?.status
    ? !['completed', 'failed'].includes(task.status)
    : false;

  const availableSpeakers = useMemo<Speaker[]>(() => ([
    { name: t("transcript.speakerA"), color: 'var(--app-primary)' },
    { name: t("transcript.speakerB"), color: 'var(--app-success)' },
    { name: t("transcript.speakerC"), color: 'var(--app-warning)' },
    { name: t("transcript.speakerD"), color: 'var(--app-danger)' },
    { name: t("transcript.speakerE"), color: 'var(--app-purple)' },
    { name: t("common.unknown"), color: 'var(--app-text-subtle)' }
  ]), [t]);

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getSpeakerColor = useCallback((speaker?: string | null) => {
    if (!speaker) return 'var(--app-text-subtle)';
    const match = availableSpeakers.find((item) => item.name === speaker);
    return match?.color || 'var(--app-text-subtle)';
  }, [availableSpeakers]);

  const parseSummaryLines = useCallback((content?: string | null) => {
    if (!content) return [];
    return content
      .split(/\n+/)
      .map((line) =>
        line
          .replace(/^\s*[-*]\s+/, '')
          .replace(/^\s*\d+\.\s+/, '')
          .replace(/^\s*\[[xX\s]\]\s+/, '')
          .trim()
      )
      .filter(Boolean);
  }, []);

  const parseActionItems = useCallback((content?: string | null): ActionItem[] => {
    if (!content) return [];
    const lines = content.split(/\n+/).map((line) => line.trim()).filter(Boolean);

    return lines.map((line, index) => {
      const completedMatch = line.match(/\[\s*[xX]\s*\]/);
      const cleaned = line
        .replace(/^\s*[-*]\s+/, '')
        .replace(/^\s*\[[xX\s]\]\s+/, '')
        .trim();

      const assigneeMatch = cleaned.match(/@([^\s]+)/);
      const deadlineMatch = cleaned.match(/\b(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2})\b/);

      const taskText = cleaned
        .replace(/@([^\s]+)/, '')
        .replace(/\b(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2})\b/, '')
        .replace(/\s+/g, ' ')
        .trim();

      return {
        id: `action-${index + 1}`,
        task: taskText || cleaned,
        assignee: assigneeMatch ? assigneeMatch[1] : t("task.pendingAssignee"),
        deadline: deadlineMatch ? deadlineMatch[1] : t("task.pendingDeadline"),
        completed: Boolean(completedMatch),
      };
    });
  }, [t]);

  const buildSummaryState = useCallback((items: SummaryItem[]) => {
    const overview = items.find((item) => item.summary_type === 'overview' && item.is_active)?.content;
    const keyPointsContent = items.find((item) => item.summary_type === 'key_points' && item.is_active)?.content;
    const actionItemsContent = items.find((item) => item.summary_type === 'action_items' && item.is_active)?.content;

    const keyPointLines = parseSummaryLines(keyPointsContent);
    const actionLines = parseActionItems(actionItemsContent);

    setKeyPoints(keyPointLines.map((text) => ({
      text,
      timeReference: '--:--',
    })));

    setActionItems(actionLines);

    setSummaryOverview(overview ? parseSummaryLines(overview) : []);
  }, [parseActionItems, parseSummaryLines]);

  const loadTask = useCallback(async () => {
    if (!id || !session?.user) return;
    setLoading(true);
    setError(null);
    try {
      const taskData = await client.getTask(id);
      setTask(taskData);
      setProgress(taskData.progress ?? 0);

      const [transcriptResult, summaryResult] = await Promise.all([
        client.getTranscript(id).catch((err) => err),
        client.getSummary(id).catch((err) => err),
      ]);

      if (transcriptResult instanceof ApiError) {
        if (transcriptResult.code === 40401) {
          setTranscript([]);
        } else {
          notifyError(transcriptResult.message);
          setTranscript([]);
        }
      } else if (transcriptResult) {
        const mappedTranscript = transcriptResult.items.map((segment: ApiTranscriptSegment) => ({
          id: segment.id,
          speaker: segment.speaker_label || t("common.unknown"),
          startTime: formatTimestamp(segment.start_time),
          endTime: formatTimestamp(segment.end_time),
          content: segment.content,
          avatarColor: getSpeakerColor(segment.speaker_label),
        }));
        setTranscript(mappedTranscript);
      }

      if (summaryResult instanceof ApiError) {
        if (summaryResult.code === 40401) {
          setKeyPoints([]);
          setActionItems([]);
          setSummaryOverview([]);
        } else {
          notifyError(summaryResult.message);
          setKeyPoints([]);
          setActionItems([]);
          setSummaryOverview([]);
        }
      } else if (summaryResult) {
        buildSummaryState(summaryResult.items);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        notifyError(err.message);
        if (err.code >= 40100 && err.code < 40200) {
          setLoginOpen(true);
        }
      } else {
        const message = err instanceof Error ? err.message : t("errors.loadTaskFailed");
        setError(message);
        notifyError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [buildSummaryState, client, getSpeakerColor, id, session, t]);

  useEffect(() => {
    if (session?.user) {
      loadTask();
    }
  }, [loadTask, session]);

  useEffect(() => {
    if (!task?.id || typeof window === "undefined") return;
    const storageKey = `task-cleanup:${task.id}`;
    const stored = window.sessionStorage.getItem(storageKey);
    if (!stored) return;

    window.sessionStorage.removeItem(storageKey);
    try {
      const payload = JSON.parse(stored) as { failedTaskIds?: string[] };
      const ids = Array.isArray(payload?.failedTaskIds)
        ? payload.failedTaskIds.filter(Boolean)
        : [];
      if (ids.length > 0) {
        setFailedTaskIds(ids);
        setShowCleanupToast(true);
      }
    } catch {
      // Ignore malformed payloads
    }
  }, [task?.id]);

  // Subscribe to global task state from WebSocket
  const globalTaskState = useGlobalStore((state) => state.tasks[id || '']);

  // Sync global state to local state
  useEffect(() => {
    if (globalTaskState) {
      setProgress(globalTaskState.progress);
      setTask((prev) =>
        prev
          ? {
              ...prev,
              status: globalTaskState.status,
              progress: globalTaskState.progress,
              error_message: globalTaskState.error_message,
            }
          : prev
      );

      // Reload task data when completed to get transcript and summary
      if (globalTaskState.status === 'completed' && task?.status !== 'completed') {
        loadTask();
      }
    }
  }, [globalTaskState, loadTask, task?.status]);

  const handleRetry = async () => {
    if (!id) return;

    setIsRetrying(true);
    try {
      const result = await client.retryTask(id, false);
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
      await loadTask();
    } catch (err) {
      if (err instanceof ApiError) {
        notifyError(err.message);
      } else {
        notifyError(t("task.retryFailed"));
      }
    } finally {
      setIsRetrying(false);
    }
  };

  const handleCleanupFailedTasks = async () => {
    if (failedTaskIds.length === 0 || isCleaning) return;

    setIsCleaning(true);
    try {
      const result = await client.batchDeleteTasks(failedTaskIds);
      if (result.deleted_count > 0) {
        notifySuccess(t("task.cleanupSuccess", { count: result.deleted_count }));
      }
      if (result.failed_ids.length > 0) {
        notifyError(t("task.cleanupPartialFailed", { count: result.failed_ids.length }));
      }
      setShowCleanupToast(false);
      setFailedTaskIds([]);
    } catch (err) {
      if (err instanceof ApiError) {
        notifyError(err.message);
      } else {
        notifyError(t("task.cleanupFailed"));
      }
    } finally {
      setIsCleaning(false);
    }
  };

  const handleDismissCleanup = () => {
    setShowCleanupToast(false);
    setFailedTaskIds([]);
  };

  const getEstimatedTime = () => {
    const remaining = 100 - progress;
    const minutes = Math.ceil((remaining / 100) * 5);
    return t("task.etaMinutes", { minutes });
  };

  const getCurrentStep = () => {
    if (progress < 10) return 1;
    if (progress < 60) return 2;
    if (progress < 90) return 3;
    if (progress < 100) return 4;
    return 5;
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  // 同步音频播放状态
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      if (audio.currentTime !== undefined && !isNaN(audio.currentTime)) {
        setCurrentTime(audio.currentTime);
      }
    };
    const handleEnded = () => setIsPlaying(false);
    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setAudioDuration(audio.duration);
      }
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    // 如果元数据已经加载，立即设置 duration
    if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
      setAudioDuration(audio.duration);
    }

    // Fallback: Manual polling for currentTime when playing (in case timeupdate doesn't fire consistently)
    let intervalId: NodeJS.Timeout | null = null;
    const handlePlayForInterval = () => {
      intervalId = setInterval(() => {
        if (audio && !audio.paused && !audio.ended) {
          updateTime();
        }
      }, 100); // Update every 100ms for smooth progress
    };
    const handlePauseForInterval = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    const handleEndedForInterval = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    audio.addEventListener('play', handlePlayForInterval);
    audio.addEventListener('pause', handlePauseForInterval);
    audio.addEventListener('ended', handleEndedForInterval);

    // If already playing, start interval
    if (!audio.paused && !audio.ended) {
      handlePlayForInterval();
    }

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlayForInterval);
      audio.removeEventListener('pause', handlePauseForInterval);
      audio.removeEventListener('ended', handleEndedForInterval);
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [task?.audio_url]); // 当 audio_url 变化时重新注册事件监听器

  const handleTimeClick = (time: string) => {
    // Convert time string to seconds
    const [mins, secs] = time.split(':').map(Number);
    if (Number.isNaN(mins) || Number.isNaN(secs)) return;
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
    { id: 'summary', label: t("task.tabs.summary") },
    { id: 'keypoints', label: t("task.tabs.keypoints") },
    { id: 'actions', label: t("task.tabs.actions") }
  ];
  // 优先使用音频元素的实际 duration，如果没有则使用后端提供的 duration_seconds
  const duration = audioDuration || task?.duration_seconds || 0;

  if (sessionStatus === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: 'var(--app-bg)' }}>
        <div className="text-sm" style={{ color: 'var(--app-text-muted)' }}>
          {t("common.loading")}...
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="h-screen flex flex-col" style={{ background: 'var(--app-bg)' }}>
        <Header
          isAuthenticated={false}
          onOpenLogin={() => setLoginOpen(true)}
          language={language}
          onToggleLanguage={onToggleLanguage}
          onToggleTheme={onToggleTheme}
        />
        <div className="flex-1 flex items-center justify-center">
          <ErrorState
            type="general"
            title={t("errors.loginToViewTitle")}
            description={t("errors.loginToViewDesc")}
            onRetry={() => setLoginOpen(true)}
            retryLabel={t("errors.retryLogin")}
          />
        </div>
        <LoginModal
          isOpen={loginOpen}
          onClose={() => setLoginOpen(false)}
          callbackUrl={`/tasks/${id}`}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: 'var(--app-bg)' }}>
        <div className="text-sm" style={{ color: 'var(--app-text-muted)' }}>
          {t("errors.loadTaskDetail")}
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="h-screen flex flex-col" style={{ background: 'var(--app-bg)' }}>
        <Header
          isAuthenticated={!!session?.user}
          onOpenLogin={() => setLoginOpen(true)}
          language={language}
          onToggleLanguage={onToggleLanguage}
          onToggleTheme={onToggleTheme}
        />
        <div className="flex-1 flex items-center justify-center">
          <ErrorState
            type="general"
            title={t("errors.taskNotFound")}
            description={error || t("errors.taskNotFoundDesc")}
            onRetry={() => router.push('/')}
            retryLabel={t("errors.backHome")}
          />
        </div>
      </div>
    );
  }

  if (task.status === 'failed') {
    return (
      <div className="h-screen flex flex-col" style={{ background: 'var(--app-bg)' }}>
        {/* Header */}
        <Header
          isAuthenticated={!!session?.user}
          onOpenLogin={() => setLoginOpen(true)}
          language={language}
          onToggleLanguage={onToggleLanguage}
          onToggleTheme={onToggleTheme}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <Sidebar />

          {/* Page Content */}
          <main className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--app-bg)' }}>
            {/* Title Bar */}
            <div
              className="flex items-center justify-between px-6 border-b"
              style={{ height: '64px', borderColor: 'var(--app-glass-border)' }}
            >
              {/* Left: Back Button */}
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-[var(--app-glass-bg-strong)] transition-colors"
                style={{ color: 'var(--app-text-muted)' }}
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm" style={{ fontWeight: 500 }}>{t("common.back")}</span>
              </button>

              {/* Center: Title */}
              <h1 className="text-xl" style={{ fontWeight: 600, color: 'var(--app-text)' }}>
                {task.title}
              </h1>

              {/* Right: Empty space for balance */}
              <div style={{ width: '100px' }}></div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
              <div
                className="w-full rounded-xl border p-10 text-center"
                style={{ maxWidth: '480px', borderColor: 'var(--app-danger-border)', background: 'var(--app-danger-bg-soft)' }}
              >
                <div className="flex justify-center mb-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--app-danger-bg)', color: 'var(--app-danger)' }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-xl mb-2" style={{ fontWeight: 600, color: 'var(--app-danger-deep)' }}>
                  {t("task.error.processingFailed")}
                </h2>
                <p className="text-sm mb-6" style={{ color: 'var(--app-danger-strong)' }}>
                  {task.error_message || t("task.error.transcribeUnavailable")}
                </p>
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="px-6 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'var(--app-danger)', color: 'var(--app-button-primary-text)' }}
                >
                  {isRetrying ? t("common.processing") : t("common.retry")}
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
      <div className="h-screen flex flex-col" style={{ background: 'var(--app-bg)' }}>
        {/* Header */}
        <Header
          isAuthenticated={!!session?.user}
          onOpenLogin={() => setLoginOpen(true)}
          language={language}
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
            style={{ background: 'var(--app-page-gradient)' }}
          >
            {/* Title Bar */}
            <div
              className="flex items-center justify-between px-6 border-b"
              style={{ 
                height: '64px', 
                borderColor: 'var(--app-glass-border)',
                background: 'var(--app-glass-bg)'
              }}
            >
              {/* Left: Back Button */}
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-[var(--app-glass-bg-strong)] transition-colors"
                style={{ color: 'var(--app-text-muted)' }}
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm" style={{ fontWeight: 500 }}>{t("common.back")}</span>
              </button>

              {/* Center: Title */}
              <h1 className="text-xl" style={{ fontWeight: 600, color: 'var(--app-text)' }}>
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
                  background: 'var(--app-glass-bg)',
                  backdropFilter: 'blur(10px)',
                  borderColor: 'var(--app-glass-border)'
                }}
              >
                <div className="flex items-start gap-3">
                  <div 
                    className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: 'var(--app-primary-soft-2)' }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--app-primary)" strokeWidth="2">
                      <path d="M9 18V5l12-2v13M9 13l12-2" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm truncate" style={{ fontWeight: 600, color: 'var(--app-text-strong)' }}>
                      {task.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs" style={{ color: 'var(--app-text-subtle)' }}>
                        {t("task.fileSizeValue", { size: "42.5 MB" })}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--app-text-faint)' }}>·</span>
                      <span className="text-xs" style={{ color: 'var(--app-text-subtle)' }}>
                        {t("task.durationValue", { duration: "45:30" })}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--app-text-faint)' }}>·</span>
                      <span className="text-xs" style={{ color: 'var(--app-text-subtle)' }}>
                        {t("task.uploadedJustNow")}
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
                status={task?.status}
                sourceType={task?.source_type}
              />

              {/* 底部提示信息 */}
              <div 
                className="w-full mt-6 text-center"
                style={{ maxWidth: '480px' }}
              >
                <div 
                  className="flex items-start gap-2 p-4 rounded-lg"
                  style={{ background: 'var(--app-primary-soft-2)' }}
                >
                  <svg 
                    className="flex-shrink-0 mt-0.5"
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="var(--app-primary)" 
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <p className="text-xs text-left" style={{ color: 'var(--app-text-muted)', lineHeight: '1.5' }}>
                    {t("task.error.processingTips")}
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
    <div className="h-screen flex flex-col" style={{ background: 'var(--app-bg)' }}>
      {/* Hidden Audio Element */}
      {task?.audio_url && (
        <audio
          ref={audioRef}
          src={task.audio_url}
          preload="metadata"
          crossOrigin="anonymous"
        />
      )}

      {/* Header */}
      <Header 
        isAuthenticated={!!session?.user}
        onOpenLogin={() => setLoginOpen(true)}
        language={language}
        onToggleLanguage={onToggleLanguage}
        onToggleTheme={onToggleTheme}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Page Content */}
        <main className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--app-bg)' }}>
          {/* Title Bar */}
          <div
            className="flex items-center justify-between px-6 border-b"
            style={{ height: '64px', borderColor: 'var(--app-glass-border)' }}
          >
            {/* Left: Back Button */}
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-[var(--app-glass-bg-strong)] transition-colors"
              style={{ color: 'var(--app-text-muted)' }}
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm" style={{ fontWeight: 500 }}>{t("common.back")}</span>
            </button>

            {/* Center: Title */}
            <h1 className="text-xl" style={{ fontWeight: 600, color: 'var(--app-text)' }}>
              {task.title}
            </h1>

            {/* Right: Export Button */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-[var(--app-glass-bg-strong)] transition-colors"
                style={{ borderColor: 'var(--app-glass-border)', color: 'var(--app-text)' }}
              >
                <span className="text-sm" style={{ fontWeight: 500 }}>{t("task.export")}</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {showExportMenu && (
                <div
                  className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg border overflow-hidden z-10"
                  style={{ background: 'var(--app-glass-bg)', borderColor: 'var(--app-glass-border)' }}
                >
                  <button className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--app-glass-bg-strong)]" style={{ color: 'var(--app-text)' }}>
                    {t("task.exportPdf")}
                  </button>
                  <button className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--app-glass-bg-strong)]" style={{ color: 'var(--app-text)' }}>
                    {t("task.exportWord")}
                  </button>
                  <button className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--app-glass-bg-strong)]" style={{ color: 'var(--app-text)' }}>
                    {t("task.exportMarkdown")}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Player Bar */}
          <div className="px-6 py-4" style={{ background: 'var(--app-glass-bg)' }}>
            <PlayerBar
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              onSeek={handleSeek}
            />
          </div>

          {/* Two Column Layout */}
          <div className="flex-1 flex overflow-hidden border-t" style={{ borderColor: 'var(--app-glass-border)' }}>
            {/* Left Column: Transcript */}
            <div className="flex-1 flex flex-col border-r" style={{ borderColor: 'var(--app-glass-border)' }}>
              {/* Column Header */}
              <div className="flex items-center gap-2 px-4 py-4 border-b" style={{ borderColor: 'var(--app-glass-border)' }}>
                <FileText className="w-5 h-5" style={{ color: 'var(--app-text)' }} />
                <h2 className="text-base" style={{ fontWeight: 600, color: 'var(--app-text)' }}>
                  {t("task.transcriptTitle")}
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
                    title={t("task.transcriptEmpty")}
                    description={t("errors.processFailedDesc")}
                    onRetry={() => window.location.reload()}
                    retryLabel={t("task.retryProcessing")}
                  />
                )}
              </div>
            </div>

            {/* Right Column: Summary Panel */}
            <div className="flex-1 flex flex-col" style={{ maxWidth: '50%' }}>
              {/* Tab Switch */}
              <div className="flex justify-center border-b" style={{ borderColor: 'var(--app-glass-border)' }}>
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
                      <h3 className="text-lg mb-2" style={{ fontWeight: 600, color: 'var(--app-text)' }}>
                        {t("task.summaryOverview")}
                      </h3>
                      {summaryOverview.length > 0 ? (
                        summaryOverview.map((line, index) => (
                          <p key={index} className="text-base leading-7" style={{ color: 'var(--app-text)' }}>
                            {line}
                          </p>
                        ))
                      ) : (
                        <p className="text-base leading-7" style={{ color: 'var(--app-text-subtle)' }}>
                          {t("task.summaryEmpty")}
                        </p>
                      )}
                    </div>

                    <div>
                      <h3 className="text-lg mb-2" style={{ fontWeight: 600, color: 'var(--app-text)' }}>
                        {t("task.keyPointsTitle")}
                      </h3>
                      {keyPoints.length > 0 ? (
                        <ol className="space-y-2 text-base leading-7" style={{ color: 'var(--app-text)' }}>
                          {keyPoints.map((point, index) => (
                            <li key={point.text}>{index + 1}. {point.text}</li>
                          ))}
                        </ol>
                      ) : (
                        <p className="text-base leading-7" style={{ color: 'var(--app-text-subtle)' }}>
                          {t("task.keyPointsEmpty")}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Key Points Tab */}
                {activeTab === 'keypoints' && (
                  <div className="space-y-4">
                    {keyPoints.map((point, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          <Lightbulb className="w-5 h-5" style={{ color: 'var(--app-warning)' }} />
                        </div>
                        <div className="flex-1">
                          <p className="text-base mb-1" style={{ color: 'var(--app-text)' }}>
                            {point.text}
                          </p>
                          <button
                            onClick={() => handleTimeClick(point.timeReference)}
                            className="text-sm hover:underline"
                            style={{ color: 'var(--app-primary)' }}
                          >
                            ↗{point.timeReference} {t("task.keyPointDetail")}
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
                          borderColor: 'var(--app-glass-border)',
                          background: item.completed ? 'var(--app-glass-bg-strong)' : 'var(--app-glass-bg)'
                        }}
                      >
                        <button
                          onClick={() => toggleActionItem(item.id)}
                          className="flex-shrink-0 mt-0.5"
                        >
                          {item.completed ? (
                            <CheckSquare className="w-5 h-5" style={{ color: 'var(--app-success)' }} />
                          ) : (
                            <div
                              className="w-5 h-5 border-2 rounded"
                              style={{ borderColor: 'var(--app-glass-border)' }}
                            />
                          )}
                        </button>
                        <div className="flex-1">
                          <p
                            className="text-base mb-1"
                            style={{
                              color: item.completed ? 'var(--app-text-subtle)' : 'var(--app-text)',
                              textDecoration: item.completed ? 'line-through' : 'none'
                            }}
                          >
                            {item.task}
                          </p>
                          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--app-text-muted)' }}>
                            <span>@{item.assignee}</span>
                            <span>·</span>
                            <span>{t("task.deadline", { date: item.deadline })}</span>
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
      {showCleanupToast && (
        <RetryCleanupToast
          failedCount={failedTaskIds.length}
          isCleaning={isCleaning}
          onCleanup={handleCleanupFailedTasks}
          onDismiss={handleDismissCleanup}
        />
      )}
    </div>
  );
}
