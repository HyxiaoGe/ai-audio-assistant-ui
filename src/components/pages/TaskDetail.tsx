"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { notifyError, notifySuccess } from '@/lib/notify';
import { ArrowLeft, ChevronDown, FileText, CheckSquare, Lightbulb } from 'lucide-react';
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import PlayerBar from '@/components/task/PlayerBar';
import TranscriptItem from '@/components/task/TranscriptItem';
import TabSwitch from '@/components/task/TabSwitch';
import YouTubePlayerCard from '@/components/task/YouTubePlayerCard';
import { VisualSummaryView } from '@/components/task/VisualSummaryView';
import ProcessingState from '@/components/common/ProcessingState';
import ErrorState from '@/components/common/ErrorState';
import LoginModal from '@/components/auth/LoginModal';
import RetryCleanupToast from '@/components/task/RetryCleanupToast';
import { useAPIClient } from '@/lib/use-api-client';
import { useGlobalStore } from '@/store/global-store';
import { useAudioStore } from '@/store/audio-store';
import { getToken } from '@/lib/auth-token';
import { ApiError } from '@/types/api';
import { formatDuration } from '@/lib/utils';
import type {
  TaskDetail as ApiTaskDetail,
  TranscriptSegment as ApiTranscriptSegment,
  TranscriptWord,
  ComparisonResult,
  SummaryItem,
  SummaryRegenerateType,
  LLMModel,
  VisualType
} from '@/types/api';
import { useI18n } from '@/lib/i18n-context';
import { useDateFormatter } from '@/lib/use-date-formatter';

interface TaskDetailProps {
  language?: 'zh' | 'en';
  onToggleTheme?: () => void;
}

interface DisplayTranscriptSegment {
  id: string;
  speaker: string;
  startTime: string;
  endTime: string;
  startSeconds: number;
  endSeconds: number;
  content: string;
  words: TranscriptWord[] | null;
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
  onToggleTheme = () => {}
}: TaskDetailProps) {
  const router = useRouter();
  const params = useParams();
  const { data: session, status: sessionStatus } = useSession();
  const client = useAPIClient();
  const { t, locale } = useI18n();
  const { formatRelativeTime } = useDateFormatter();
  const id = params?.id as string;
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const currentTime = useAudioStore((state) => state.currentTime);
  const audioDuration = useAudioStore((state) => state.duration);
  const currentSrc = useAudioStore((state) => state.src);
  const setSource = useAudioStore((state) => state.setSource);
  const togglePlayback = useAudioStore((state) => state.toggle);
  const play = useAudioStore((state) => state.play);
  const seek = useAudioStore((state) => state.seek);
  const [activeTab, setActiveTab] = useState('summary');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loginOpen, setLoginOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showCleanupToast, setShowCleanupToast] = useState(false);
  const [failedTaskIds, setFailedTaskIds] = useState<string[]>([]);
  const [isCleaning, setIsCleaning] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [task, setTask] = useState<ApiTaskDetail | null>(null);
  const [transcript, setTranscript] = useState<DisplayTranscriptSegment[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [activeWordKey, setActiveWordKey] = useState<{ segmentId: string; index: number } | null>(null);
  const [activeWordProgress, setActiveWordProgress] = useState<number | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(true);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const transcriptItemRefs = useRef(new Map<string, HTMLDivElement>());
  const autoScrollPauseUntilRef = useRef(0);
  const programmaticScrollRef = useRef(false);
  const resumeScrollTimerRef = useRef<number | null>(null);
  const activeSegmentIdRef = useRef<string | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [keyPoints, setKeyPoints] = useState<KeyPoint[]>([]);
  const [summaryOverviewMarkdown, setSummaryOverviewMarkdown] = useState<string>('');
  const [keyPointsMarkdown, setKeyPointsMarkdown] = useState<string>('');
  const [actionItemsMarkdown, setActionItemsMarkdown] = useState<string>('');
  const [visualSummaries, setVisualSummaries] = useState<SummaryItem[]>([]);
  const [summaryModelUsed, setSummaryModelUsed] = useState<Record<SummaryRegenerateType, string | null>>({
    overview: null,
    key_points: null,
    action_items: null,
  });
  const [summaryStreaming, setSummaryStreaming] = useState({
    overview: false,
    key_points: false,
    action_items: false,
  });
  const [summaryStreamContent, setSummaryStreamContent] = useState<Record<SummaryRegenerateType, string>>({
    overview: "",
    key_points: "",
    action_items: "",
  });
  const [summaryVersions, setSummaryVersions] = useState<Record<SummaryRegenerateType, number>>({
    overview: 0,
    key_points: 0,
    action_items: 0,
  });
  const summaryStreamRef = useRef<Record<SummaryRegenerateType, EventSource | null>>({
    overview: null,
    key_points: null,
    action_items: null,
  });
  const summaryBufferRef = useRef<Record<SummaryRegenerateType, string>>({
    overview: '',
    key_points: '',
    action_items: '',
  });
  const summaryPollRef = useRef<Record<SummaryRegenerateType, number | null>>({
    overview: null,
    key_points: null,
    action_items: null,
  });
  const [llmModels, setLlmModels] = useState<LLMModel[]>([]);
  const [summaryModelSelection, setSummaryModelSelection] = useState<Record<SummaryRegenerateType, string | null>>({
    overview: null,
    key_points: null,
    action_items: null,
  });
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [compareSelectedModels, setCompareSelectedModels] = useState<string[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSummaryType, setCompareSummaryType] = useState<SummaryRegenerateType>("overview");
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[]>([]);
  const [compareActiveModel, setCompareActiveModel] = useState<string | null>(null);
  const [compareActivating, setCompareActivating] = useState(false);
  const comparePollRef = useRef<number | null>(null);
  const compareStreamRef = useRef<EventSource | null>(null);
  const compareExpectedRef = useRef<number>(0);
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
    { name: t("transcript.unknownSpeaker"), color: 'var(--app-text-subtle)' }
  ]), [t]);

  // Render Markdown content for summaries
  const renderMarkdownContent = (content: string) => {
    return (
      <div className="prose prose-sm max-w-none markdown-summary" style={{ color: 'var(--app-text)' }}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
          components={{
            input: ({ ...props }) => {
              if (props.type === "checkbox") {
                return <input {...props} className="mr-2 align-middle" readOnly style={{ cursor: "default" }} />;
              }
              return <input {...props} />;
            },
            table: ({ ...props }) => (
              <div className="overflow-x-auto my-4">
                <table {...props} className="min-w-full border-collapse" style={{ border: "1px solid var(--app-glass-border)" }} />
              </div>
            ),
            th: ({ ...props }) => (
              <th {...props} className="px-4 py-2 text-left font-semibold" style={{ backgroundColor: "var(--app-glass-bg)", borderBottom: "2px solid var(--app-glass-border)" }} />
            ),
            td: ({ ...props }) => (
              <td {...props} className="px-4 py-2" style={{ borderBottom: "1px solid var(--app-glass-border)" }} />
            ),
            ul: ({ ...props }) => <ul {...props} className="space-y-2 my-4" />,
            ol: ({ ...props }) => <ol {...props} className="space-y-2 my-4" />,
            li: ({ children, ...props }) => {
              const content = String(children);
              const isHighPriority = content.includes("高优先级") || content.includes("紧急");
              const isLowPriority = content.includes("低优先级") || content.includes("可选");
              return (
                <li {...props} className="leading-relaxed" style={isHighPriority ? { color: "var(--app-danger)" } : isLowPriority ? { color: "var(--app-text-subtle)" } : undefined}>
                  {children}
                </li>
              );
            },
            h1: ({ ...props }) => <h1 {...props} className="text-2xl font-bold mt-6 mb-4" style={{ color: "var(--app-text)" }} />,
            h2: ({ ...props }) => <h2 {...props} className="text-xl font-semibold mt-5 mb-3" style={{ color: "var(--app-text)" }} />,
            h3: ({ ...props }) => <h3 {...props} className="text-lg font-semibold mt-4 mb-2" style={{ color: "var(--app-text)" }} />,
            p: ({ ...props }) => <p {...props} className="my-3 leading-relaxed" />,
            code: ({ className, children, ...props }) => {
              const isInline = !className;
              if (isInline) {
                return <code {...props} className="px-1.5 py-0.5 rounded text-sm" style={{ backgroundColor: "var(--app-glass-bg)", color: "var(--app-primary)" }}>{children}</code>;
              }
              return <code {...props} className={`block p-3 rounded text-sm overflow-x-auto ${className || ""}`} style={{ backgroundColor: "var(--app-glass-bg)" }}>{children}</code>;
            },
            blockquote: ({ ...props }) => <blockquote {...props} className="border-l-4 pl-4 my-4 italic" style={{ borderColor: "var(--app-primary)", color: "var(--app-text-muted)" }} />,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  };

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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

    // Extract visual summaries
    const visuals = items.filter((item) =>
      item.summary_type.startsWith('visual_') && item.is_active
    );
    setVisualSummaries(visuals);

    const modelUsed = {
      overview: items.find((item) => item.summary_type === 'overview' && item.is_active)?.model_used ?? null,
      key_points: items.find((item) => item.summary_type === 'key_points' && item.is_active)?.model_used ?? null,
      action_items: items.find((item) => item.summary_type === 'action_items' && item.is_active)?.model_used ?? null,
    };
    const latestVersions = {
      overview: items.find((item) => item.summary_type === 'overview' && item.is_active)?.version ?? 0,
      key_points: items.find((item) => item.summary_type === 'key_points' && item.is_active)?.version ?? 0,
      action_items: items.find((item) => item.summary_type === 'action_items' && item.is_active)?.version ?? 0,
    };

    // Store raw Markdown content (V1.2 format)
    setSummaryOverviewMarkdown(overview || '');
    setKeyPointsMarkdown(keyPointsContent || '');
    setActionItemsMarkdown(actionItemsContent || '');

    // Also parse to old format for backward compatibility
    const keyPointLines = parseSummaryLines(keyPointsContent);
    const actionLines = parseActionItems(actionItemsContent);

    setKeyPoints(keyPointLines.map((text) => ({
      text,
      timeReference: '--:--',
    })));

    setActionItems(actionLines);

    setSummaryVersions(latestVersions);
    setSummaryModelUsed(modelUsed);
  }, [parseActionItems, parseSummaryLines]);

  const loadTask = useCallback(async () => {
    if (!id || !session?.user) return;
    setLoading(true);
    setError(null);
    setTranscriptLoading(true);
    setTranscript([]);
    setActiveSegmentId(null);
    setActiveWordKey(null);
    setActiveWordProgress(null);
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
        const unknownSpeakerLabel = t("transcript.unknownSpeaker");
        const speakerPalette = availableSpeakers.filter((spk) => spk.name !== unknownSpeakerLabel);
        const speakerMap = new Map<string, Speaker>();
        let paletteIndex = 0;
        transcriptResult.items.forEach((segment: ApiTranscriptSegment) => {
          const speakerId = segment.speaker_id;
          if (!speakerId) return;
          if (!speakerMap.has(speakerId)) {
            const speakerInfo = speakerPalette[paletteIndex % speakerPalette.length];
            if (speakerInfo) {
              speakerMap.set(speakerId, speakerInfo);
            }
            paletteIndex += 1;
          }
        });
        const mappedTranscript = transcriptResult.items.map((segment: ApiTranscriptSegment) => {
          const speakerInfo = segment.speaker_id ? speakerMap.get(segment.speaker_id) : null;
          return {
            id: segment.id,
            speaker: speakerInfo?.name || unknownSpeakerLabel,
            startTime: formatTimestamp(segment.start_time),
            endTime: formatTimestamp(segment.end_time),
            startSeconds: segment.start_time,
            endSeconds: segment.end_time,
            content: segment.content,
            words: segment.words ?? null,
            avatarColor: speakerInfo?.color || 'var(--app-text-subtle)',
          };
        });
        setTranscript(mappedTranscript);
      }

      if (summaryResult instanceof ApiError) {
        if (summaryResult.code === 40401) {
          setKeyPoints([]);
          setActionItems([]);
          setSummaryOverviewMarkdown('');
        } else {
          notifyError(summaryResult.message);
          setKeyPoints([]);
          setActionItems([]);
          setSummaryOverviewMarkdown('');
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
      setTranscriptLoading(false);
      setLoading(false);
    }
  }, [buildSummaryState, client, id, session, t, availableSpeakers]);

  useEffect(() => {
    const summaryStreams = summaryStreamRef.current;
    const summaryPolls = summaryPollRef.current;
    const comparePoll = comparePollRef.current;
    const compareStream = compareStreamRef.current;
    const resumeTimer = resumeScrollTimerRef.current;
    return () => {
      (Object.keys(summaryStreams) as SummaryRegenerateType[]).forEach((type) => {
        summaryStreams[type]?.close();
        if (summaryPolls[type]) {
          window.clearInterval(summaryPolls[type] ?? undefined);
        }
      });
      if (comparePoll) {
        window.clearInterval(comparePoll);
      }
      compareStream?.close();
      if (resumeTimer) {
        window.clearTimeout(resumeTimer);
      }
    };
  }, []);

  const updateSummaryFromStream = useCallback(
    (summaryType: SummaryRegenerateType, content: string) => {
      setSummaryStreamContent((prev) => ({ ...prev, [summaryType]: content }));
      if (summaryType === 'overview') {
        setSummaryOverviewMarkdown(content);
      } else if (summaryType === 'key_points') {
        setKeyPointsMarkdown(content);
        const keyPointLines = parseSummaryLines(content);
        setKeyPoints(keyPointLines.map((text) => ({
          text,
          timeReference: '--:--',
        })));
      } else if (summaryType === 'action_items') {
        setActionItemsMarkdown(content);
        setActionItems(parseActionItems(content));
      }
    },
    [parseActionItems, parseSummaryLines]
  );

  const regenerateSummary = useCallback(
    async (summaryType: SummaryRegenerateType) => {
      if (!id) return;
      if (summaryStreaming[summaryType]) return;
      const selectedModelId = summaryModelSelection[summaryType] ?? null;
      const selectedModel = selectedModelId
        ? llmModels.find((model) =>
            model.model_id ? model.model_id === selectedModelId : model.provider === selectedModelId
          ) || null
        : null;

      summaryStreamRef.current[summaryType]?.close();
      summaryStreamRef.current[summaryType] = null;
      if (summaryPollRef.current[summaryType]) {
        window.clearInterval(summaryPollRef.current[summaryType] ?? undefined);
        summaryPollRef.current[summaryType] = null;
      }
      summaryBufferRef.current[summaryType] = '';

      setSummaryStreaming((prev) => ({ ...prev, [summaryType]: true }));
      updateSummaryFromStream(summaryType, '');

      try {
        const previousVersion = summaryVersions[summaryType] || 0;
        const startPolling = () => {
          summaryPollRef.current[summaryType] = window.setInterval(async () => {
            try {
              const result = await client.getSummary(id);
              const latest = result.items.find(
                (item) => item.summary_type === summaryType && item.is_active
              );
              if (latest && latest.version > previousVersion) {
                window.clearInterval(summaryPollRef.current[summaryType] ?? undefined);
                summaryPollRef.current[summaryType] = null;
                setSummaryStreaming((prev) => ({ ...prev, [summaryType]: false }));
                buildSummaryState(result.items);
              }
            } catch {
              // Ignore polling errors, keep trying
            }
          }, 2000);

          window.setTimeout(() => {
            if (summaryPollRef.current[summaryType]) {
              window.clearInterval(summaryPollRef.current[summaryType] ?? undefined);
              summaryPollRef.current[summaryType] = null;
              setSummaryStreaming((prev) => ({ ...prev, [summaryType]: false }));
              notifyError(t("task.retryFailed"));
            }
          }, 120000);
        };

        const rawBaseUrl =
          process.env.NEXT_PUBLIC_API_URL ||
          process.env.NEXT_PUBLIC_API_BASE_URL ||
          'http://localhost:8000';
        const normalizedBaseUrl = /\/api\/v1\/?$/.test(rawBaseUrl)
          ? rawBaseUrl.replace(/\/$/, '')
          : `${rawBaseUrl.replace(/\/$/, '')}/api/v1`;

        const token = await getToken();
        if (token) {
          const streamUrl = `${normalizedBaseUrl}/summaries/${id}/stream?summary_type=${summaryType}&token=${encodeURIComponent(token)}`;
          const eventSource = new EventSource(streamUrl);
          summaryStreamRef.current[summaryType] = eventSource;
          let regenerateTriggered = false;
          let connectedReceived = false;

          const triggerRegenerate = async () => {
            if (regenerateTriggered) return;
            regenerateTriggered = true;
            await client.regenerateSummary(id, {
              summary_type: summaryType,
              provider: selectedModel?.provider ?? null,
              model_id: selectedModel?.model_id ?? null,
            });
          };

          const connectionTimeout = window.setTimeout(() => {
            if (!connectedReceived) {
              triggerRegenerate().catch((err) => {
                setSummaryStreaming((prev) => ({ ...prev, [summaryType]: false }));
                if (err instanceof ApiError) {
                  notifyError(err.message);
                } else {
                  notifyError(t("task.retryFailed"));
                }
              });
            }
          }, 3000);

          const handleStreamError = (message?: string) => {
            eventSource.close();
            summaryStreamRef.current[summaryType] = null;
            setSummaryStreaming((prev) => ({ ...prev, [summaryType]: false }));
            notifyError(message || t("task.retryFailed"));
            startPolling();
          };

          eventSource.addEventListener("connected", () => {
            connectedReceived = true;
            window.clearTimeout(connectionTimeout);
            triggerRegenerate().catch((err) => {
              handleStreamError(err instanceof ApiError ? err.message : undefined);
            });
          });

          eventSource.addEventListener("summary.started", (event) => {
            try {
              const payload = JSON.parse(event.data);
              if (payload.summary_type && payload.summary_type !== summaryType) return;
              summaryBufferRef.current[summaryType] = '';
              updateSummaryFromStream(summaryType, '');
            } catch {
              // Ignore malformed payloads
            }
          });

          eventSource.addEventListener("summary.delta", (event) => {
            try {
              const payload = JSON.parse(event.data);
              if (payload.summary_type && payload.summary_type !== summaryType) return;
              if (typeof payload.content !== 'string') return;
              summaryBufferRef.current[summaryType] += payload.content;
              updateSummaryFromStream(summaryType, summaryBufferRef.current[summaryType]);
            } catch {
              // Ignore malformed payloads
            }
          });

          eventSource.addEventListener("summary.completed", (event) => {
            try {
              const payload = JSON.parse(event.data);
              if (payload.summary_type && payload.summary_type !== summaryType) return;
            } catch {
              // Ignore malformed payloads
            }
            eventSource.close();
            summaryStreamRef.current[summaryType] = null;
            setSummaryStreaming((prev) => ({ ...prev, [summaryType]: false }));
            client.getSummary(id).then((result) => {
              buildSummaryState(result.items);
            });
          });

          eventSource.addEventListener("error", (event) => {
            try {
              const payload = JSON.parse((event as MessageEvent).data);
              handleStreamError(payload?.message);
            } catch {
              handleStreamError();
            }
          });

          eventSource.onerror = () => {
            window.clearTimeout(connectionTimeout);
            handleStreamError();
          };
        } else {
          await client.regenerateSummary(id, {
            summary_type: summaryType,
            provider: selectedModel?.provider ?? null,
            model_id: selectedModel?.model_id ?? null,
          });
          startPolling();
        }
      } catch (err) {
        setSummaryStreaming((prev) => ({ ...prev, [summaryType]: false }));
        if (err instanceof ApiError) {
          notifyError(err.message);
        } else {
          notifyError(t("task.retryFailed"));
        }
      }
    },
    [buildSummaryState, client, id, llmModels, summaryModelSelection, summaryStreaming, summaryVersions, t, updateSummaryFromStream]
  );

  useEffect(() => {
    if (session?.user) {
      loadTask();
    }
  }, [loadTask, session]);

  useEffect(() => {
    if (!session?.user) return;
    let active = true;
    const loadModels = async () => {
      try {
        const result = await client.getLLMModels();
        if (active) {
          setLlmModels(result.models || []);
        }
      } catch {
        if (active) {
          setLlmModels([]);
        }
      }
    };
    loadModels();
    return () => {
      active = false;
    };
  }, [client, locale, session?.user]);

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

  useEffect(() => {
    if (!compareMode) return;
    const expected = compareExpectedRef.current;
    if (!expected) return;
    const completed = comparisonResults.filter((item) => item.status === "completed").length;
    if (completed >= expected) {
      setCompareLoading(false);
    }
  }, [compareMode, comparisonResults]);

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
      const result = await client.retryTask(id);
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

  const handleDeleteTask = async () => {
    if (!task || isDeleting) return;

    setIsDeleting(true);
    try {
      await client.deleteTask(task.id);
      notifySuccess(t("task.deleteSuccess"));
      setDeleteOpen(false);
      router.push('/tasks');
    } catch (err) {
      if (err instanceof ApiError) {
        notifyError(err.message);
      } else {
        notifyError(t("task.deleteFailed"));
      }
    } finally {
      setIsDeleting(false);
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

  const handlePlayPause = () => {
    if (!task?.audio_url) return;
    if (currentSrc !== task.audio_url) {
      setSource(task.audio_url, task.id, task.title);
      play();
      return;
    }
    togglePlayback();
  };

  const handleSeek = (time: number) => {
    if (task?.audio_url && currentSrc !== task.audio_url) {
      setSource(task.audio_url, task.id, task.title);
    }
    seek(time);
  };

  useEffect(() => {
    if (!task?.audio_url) return;
    let behavior: "keep" | "switch" | "auto" = "keep";
    try {
      const saved = localStorage.getItem("settings");
      if (saved) {
        const parsed = JSON.parse(saved) as { playbackBehavior?: "keep" | "switch" | "auto" };
        if (parsed.playbackBehavior) behavior = parsed.playbackBehavior;
      }
    } catch {
      // Ignore storage errors
    }
    if (behavior === "keep") {
      if (!currentSrc) {
        setSource(task.audio_url, task.id, task.title);
      }
      return;
    }
    setSource(task.audio_url, task.id, task.title);
    if (behavior === "auto") {
      play();
    }
  }, [currentSrc, play, setSource, task?.audio_url, task?.id, task?.title]);

  const handleTimeClick = (time: string) => {
    // Convert time string to seconds
    const [mins, secs] = time.split(':').map(Number);
    if (Number.isNaN(mins) || Number.isNaN(secs)) return;
    const totalSeconds = mins * 60 + secs;
    handleSeek(totalSeconds);
  };

  const handleEditTranscript = (segmentId: string, newContent: string) => {
    setTranscript(prev =>
      prev.map(segment =>
        segment.id === segmentId ? { ...segment, content: newContent } : segment
      )
    );
  };

  const isActiveAudio = Boolean(task?.audio_url && currentSrc === task.audio_url);
  // 优先使用音频元素的实际 duration，如果没有则使用后端提供的 duration_seconds
  const duration = isActiveAudio
    ? (audioDuration || task?.duration_seconds || 0)
    : (task?.duration_seconds || 0);
  const displayCurrentTime = isActiveAudio ? currentTime : 0;
  const displayIsPlaying = isActiveAudio ? isPlaying : false;

  const scrollToTranscriptItem = useCallback((segmentId: string) => {
    const container = transcriptScrollRef.current;
    const node = transcriptItemRefs.current.get(segmentId);
    if (!container || !node) return;
    programmaticScrollRef.current = true;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 300);
  }, []);

  const scheduleAutoScrollResume = useCallback(() => {
    if (resumeScrollTimerRef.current) {
      window.clearTimeout(resumeScrollTimerRef.current);
    }
    resumeScrollTimerRef.current = window.setTimeout(() => {
      const segmentId = activeSegmentIdRef.current;
      if (!segmentId) return;
      if (Date.now() < autoScrollPauseUntilRef.current) return;
      scrollToTranscriptItem(segmentId);
    }, 3000);
  }, [scrollToTranscriptItem]);

  useEffect(() => {
    activeSegmentIdRef.current = activeSegmentId;
  }, [activeSegmentId]);

  useEffect(() => {
    if (!isActiveAudio || transcript.length === 0) {
      setActiveSegmentId(null);
      setActiveWordKey(null);
      setActiveWordProgress(null);
      return;
    }
    let nextSegment: DisplayTranscriptSegment | null = null;
    for (const segment of transcript) {
      if (currentTime < segment.startSeconds) {
        break;
      }
      nextSegment = segment;
      if (currentTime <= segment.endSeconds) {
        break;
      }
    }
    const nextId = nextSegment?.id ?? null;
    setActiveSegmentId((prev) => (prev === nextId ? prev : nextId));
    let nextWordIndex: number | null = null;
    if (nextSegment?.words && nextSegment.words.length > 0) {
      let candidate: number | null = null;
      for (let i = 0; i < nextSegment.words.length; i += 1) {
        const word = nextSegment.words[i];
        if (currentTime < word.start_time) {
          break;
        }
        candidate = i;
        if (currentTime <= word.end_time) {
          break;
        }
      }
      nextWordIndex = candidate;
    }
    setActiveWordKey((prev) => {
      if (!nextId || nextWordIndex === null) {
        return prev ? null : prev;
      }
      if (prev?.segmentId === nextId && prev.index === nextWordIndex) {
        return prev;
      }
      return { segmentId: nextId, index: nextWordIndex };
    });
    if (!nextId || nextWordIndex === null || !nextSegment?.words) {
      setActiveWordProgress(null);
      return;
    }
    const word = nextSegment.words[nextWordIndex];
    const duration = Math.max(word.end_time - word.start_time, 0.001);
    const ratio = (currentTime - word.start_time) / duration;
    setActiveWordProgress(Math.min(1, Math.max(0, ratio)));
  }, [currentTime, isActiveAudio, transcript]);

  useEffect(() => {
    if (!activeSegmentId) return;
    if (Date.now() < autoScrollPauseUntilRef.current) return;
    scrollToTranscriptItem(activeSegmentId);
  }, [activeSegmentId, scrollToTranscriptItem]);

  useEffect(() => {
    const container = transcriptScrollRef.current;
    if (!container) return;

    const pauseAutoScroll = () => {
      autoScrollPauseUntilRef.current = Date.now() + 3000;
      scheduleAutoScrollResume();
    };

    const handleScroll = () => {
      if (programmaticScrollRef.current) return;
      pauseAutoScroll();
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    container.addEventListener("wheel", pauseAutoScroll, { passive: true });
    container.addEventListener("touchmove", pauseAutoScroll, { passive: true });
    container.addEventListener("pointerdown", pauseAutoScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
      container.removeEventListener("wheel", pauseAutoScroll);
      container.removeEventListener("touchmove", pauseAutoScroll);
      container.removeEventListener("pointerdown", pauseAutoScroll);
    };
  }, [scheduleAutoScrollResume]);

  const toggleActionItem = (itemId: string) => {
    setActionItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const getSummaryTypeByTab = useCallback((): SummaryRegenerateType => {
    if (activeTab === "keypoints") return "key_points";
    if (activeTab === "actions") return "action_items";
    return "overview";
  }, [activeTab]);

  const openCompareDialog = () => {
    setCompareSummaryType(getSummaryTypeByTab());
    if (compareSelectedModels.length < 2) {
      const defaults = compareDefaultSelection();
      if (defaults.length >= 2) {
        setCompareSelectedModels(defaults);
      }
    }
    setCompareDialogOpen(true);
  };

  const toggleCompareModel = (modelValue: string) => {
    setCompareSelectedModels((prev) =>
      prev.includes(modelValue)
        ? prev.filter((item) => item !== modelValue)
        : [...prev, modelValue]
    );
  };

  const startCompare = async () => {
    if (!id) return;
    if (compareSelectedModels.length < 2) {
      setCompareError(t("task.compareMinModels"));
      return;
    }
    setCompareError(null);
    setCompareLoading(true);
    setComparisonResults([]);
    setCompareMode(true);
    compareExpectedRef.current = compareSelectedModels.length;
    setCompareActiveModel(getModelKey(compareSelectedModels[0]));

    if (comparePollRef.current) {
      window.clearInterval(comparePollRef.current);
      comparePollRef.current = null;
    }
    compareStreamRef.current?.close();
    compareStreamRef.current = null;

    try {
      const comparison = await client.compareSummaries(id, {
        summary_type: compareSummaryType,
        models: compareSelectedModels.map(resolveModelPayload),
      });

      const expected = compareSelectedModels.length;
      const startPollingFallback = () => {
        const poll = async () => {
          try {
            const result = await client.getSummaryComparison(id, comparison.comparison_id);
            setComparisonResults(result.results || []);
            const completedCount = (result.results || []).filter((item) => item.status === "completed").length;
            if (completedCount >= expected) {
              if (comparePollRef.current) {
                window.clearInterval(comparePollRef.current);
                comparePollRef.current = null;
              }
              setCompareLoading(false);
              const firstModel =
                compareSelectedModels[0] ||
                result.models?.[0]?.model_id ||
                result.models?.[0]?.provider;
              setCompareActiveModel(firstModel ? getModelKey(firstModel) : null);
            }
          } catch {
            // Ignore poll errors
          }
        };

        poll();
        comparePollRef.current = window.setInterval(poll, 2000);
        window.setTimeout(() => {
          if (comparePollRef.current) {
            window.clearInterval(comparePollRef.current);
            comparePollRef.current = null;
            setCompareLoading(false);
            setCompareError(t("task.compareTimeout"));
          }
        }, 120000);
      };

      const rawBaseUrl =
        process.env.NEXT_PUBLIC_API_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        'http://localhost:8000';
      const normalizedBaseUrl = /\/api\/v1\/?$/.test(rawBaseUrl)
        ? rawBaseUrl.replace(/\/$/, '')
        : `${rawBaseUrl.replace(/\/$/, '')}/api/v1`;
      const token = await getToken();

      if (token) {
        const streamUrl = `${normalizedBaseUrl}/summaries/${id}/compare/${comparison.comparison_id}/stream?summary_type=${compareSummaryType}&token=${encodeURIComponent(token)}`;
        const eventSource = new EventSource(streamUrl);
        compareStreamRef.current = eventSource;

        const handleStreamError = (message?: string) => {
          eventSource.close();
          compareStreamRef.current = null;
          setCompareError(message || t("task.compareFailed"));
          startPollingFallback();
        };

        eventSource.addEventListener("summary.started", (event) => {
          try {
            const payload = JSON.parse(event.data);
            const modelKey = getStreamModelKey(payload);
            if (!modelKey) return;
            upsertComparisonResult(modelKey, (prev) => ({
              ...prev,
              content: "",
              status: "generating",
            }));
          } catch {
            // Ignore malformed payloads
          }
        });

        eventSource.addEventListener("summary.delta", (event) => {
          try {
            const payload = JSON.parse(event.data);
            const modelKey = getStreamModelKey(payload);
            if (!modelKey || typeof payload.content !== "string") return;
            upsertComparisonResult(modelKey, (prev) => ({
              ...prev,
              content: `${prev.content}${payload.content}`,
              status: "generating",
            }));
          } catch {
            // Ignore malformed payloads
          }
        });

        eventSource.addEventListener("summary.completed", (event) => {
          try {
            const payload = JSON.parse(event.data);
            const modelKey = getStreamModelKey(payload);
            if (!modelKey) return;
            setComparisonResults((prev) => {
              const index = prev.findIndex((item) => getModelKey(item.model) === modelKey);
              let next = prev;
              if (index >= 0) {
                next = [...prev];
                next[index] = {
                  ...next[index],
                  status: "completed",
                  summary_id: payload.summary_id ?? next[index].summary_id ?? null,
                };
              } else {
                next = [
                  ...prev,
                  {
                    model: modelKey,
                    content: "",
                    token_count: null,
                    created_at: new Date().toISOString(),
                    status: "completed",
                    summary_id: payload.summary_id ?? null,
                  },
                ];
              }
              const completedCount = next.filter((item) => item.status === "completed").length;
              if (completedCount >= expected) {
                eventSource.close();
                compareStreamRef.current = null;
                setCompareLoading(false);
              }
              return next;
            });
          } catch {
            // Ignore malformed payloads
          }
        });

        eventSource.addEventListener("error", (event) => {
          try {
            const payload = JSON.parse((event as MessageEvent).data);
            handleStreamError(payload?.message);
          } catch {
            handleStreamError();
          }
        });

        eventSource.onerror = () => {
          handleStreamError();
        };
      } else {
        startPollingFallback();
      }
    } catch (err) {
      setCompareLoading(false);
      if (err instanceof ApiError) {
        setCompareError(err.message);
      } else {
        setCompareError(t("task.compareFailed"));
      }
    }
  };

  const clearCompare = () => {
    setCompareActiveModel(null);
    setComparisonResults([]);
    setCompareError(null);
    setCompareLoading(false);
    setCompareMode(false);
    setCompareActivating(false);
    compareExpectedRef.current = 0;
    if (comparePollRef.current) {
      window.clearInterval(comparePollRef.current);
      comparePollRef.current = null;
    }
    compareStreamRef.current?.close();
    compareStreamRef.current = null;
  };

  const activateComparisonResult = async (summaryId: string | null | undefined) => {
    if (!id) return;
    if (!summaryId) {
      notifyError(t("task.compareMissingSummary"));
      return;
    }
    setCompareActivating(true);
    try {
      await client.activateSummary(id, summaryId);
      const summaryResult = await client.getSummary(id);
      buildSummaryState(summaryResult.items);
      notifySuccess(t("task.compareActivateSuccess"));
      clearCompare();
    } catch (err) {
      if (err instanceof ApiError) {
        notifyError(err.message);
      } else {
        notifyError(t("task.compareActivateFailed"));
      }
    } finally {
      setCompareActivating(false);
    }
  };

  const renderCompareView = () => (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {compareSelectedModels.map((modelValue) => {
          const modelKey = getModelKey(modelValue);
          const isActive = compareActiveModel === modelKey;
          const status = getCompareStatus(modelValue);
          const statusColor = status === "completed"
            ? "var(--app-success)"
            : status === "failed"
              ? "var(--app-danger)"
              : status === "generating"
                ? "var(--app-primary)"
                : "var(--app-text-subtle)";
          return (
            <button
              key={modelValue}
              onClick={() => setCompareActiveModel(modelKey)}
              className="text-xs px-3 py-1 rounded-full transition-colors"
              style={{
                background: isActive ? 'var(--app-primary)' : 'var(--app-glass-bg-strong)',
                color: isActive ? 'var(--app-button-primary-text)' : 'var(--app-text)',
              }}
            >
              <span
                className="inline-block size-2 rounded-full mr-2 align-middle"
                style={{
                  background: statusColor,
                  animation: status === "generating"
                    ? "comparePulse 1.1s ease-in-out infinite"
                    : undefined,
                }}
              />
              {getModelCompareLabel(modelKey)}
            </button>
          );
        })}
        <button
          onClick={clearCompare}
          className="text-xs px-3 py-1 rounded-full transition-colors"
          style={{
            background: 'transparent',
            color: 'var(--app-text-subtle)',
            border: '1px dashed var(--app-glass-border)',
          }}
        >
          {t("task.compareExit")}
        </button>
      </div>
      {compareLoading && (
        <p className="text-sm" style={{ color: 'var(--app-text-subtle)' }}>
          {t("task.compareLoading", {
            count: comparisonResults.filter((item) => item.status === "completed").length,
            total: compareSelectedModels.length,
          })}
        </p>
      )}
      {compareError && (
        <p className="text-sm" style={{ color: 'var(--app-danger)' }}>
          {compareError}
        </p>
      )}
      {(() => {
        const activeKey = compareActiveModel || getModelKey(compareSelectedModels[0]);
        const result = comparisonResults.find((item) => {
          const normalized = getModelKey(item.model);
          return normalized === activeKey;
        });
        if (!result) {
          return (
            <p className="text-base leading-7" style={{ color: 'var(--app-text-subtle)' }}>
              {t("task.comparePending")}
            </p>
          );
        }
        return (
          <div className="space-y-3">
            <p className="text-base leading-7" style={{ color: 'var(--app-text)' }}>
              {result.content}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => activateComparisonResult(result.summary_id)}
                disabled={result.status !== "completed" || compareActivating}
                className="text-xs px-3 py-1 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'var(--app-primary)', color: 'var(--app-button-primary-text)' }}
              >
                {compareActivating ? t("task.compareActivating") : t("task.compareActivate")}
              </button>
              {result.status !== "completed" && (
                <span className="text-xs" style={{ color: 'var(--app-text-subtle)' }}>
                  {t("task.compareActivateHint")}
                </span>
              )}
            </div>
          </div>
        );
      })()}
      <style jsx>{`
        @keyframes comparePulse {
          0% {
            opacity: 0.35;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0.35;
          }
        }
      `}</style>
    </div>
  );

  const summaryTabs = useMemo(() => {
    const baseTabs = [
      { id: 'summary', label: t("task.tabs.summary") },
      { id: 'keypoints', label: t("task.tabs.keypoints") },
      { id: 'actions', label: t("task.tabs.actions") }
    ];

    // Add visual summary tabs dynamically (deduplicated by summary_type)
    const seenTypes = new Set<string>();
    const visualTabs = visualSummaries
      .filter((summary) => {
        if (seenTypes.has(summary.summary_type)) return false;
        seenTypes.add(summary.summary_type);
        return true;
      })
      .map((summary) => {
        const visualType = summary.summary_type.replace('visual_', '');
        const labelMap: Record<string, string> = {
          mindmap: t("summary.type.mindmap"),
          timeline: t("summary.type.timeline"),
          flowchart: t("summary.type.flowchart"),
        };
        return {
          id: summary.summary_type,
          label: labelMap[visualType] || visualType
        };
      });

    return [...baseTabs, ...visualTabs];
  }, [t, visualSummaries]);
  const getSummaryEmptyText = (
    summaryType: SummaryRegenerateType,
    emptyKey: string
  ) => {
    if (summaryStreaming[summaryType]) return t("task.summaryGenerating");
    if (summaryVersions[summaryType] > 0) return t("task.summaryEmptyAfter");
    return t(emptyKey);
  };
  const modelNameMap = useMemo(() => {
    const map = new Map<string, { displayName: string; modelId?: string }>();
    llmModels.forEach((model) => {
      map.set(model.provider, { displayName: model.display_name, modelId: model.model_id });
      if (model.model_id) {
        map.set(model.model_id, { displayName: model.display_name, modelId: model.model_id });
      }
    });
    return map;
  }, [llmModels]);
  const modelGroups = useMemo(() => {
    const groups = new Map<string, LLMModel[]>();
    llmModels.forEach((model) => {
      const key = model.display_name || model.provider;
      const list = groups.get(key) || [];
      list.push(model);
      groups.set(key, list);
    });
    return Array.from(groups.entries()).map(([label, models]) => ({
      label,
      models,
    }));
  }, [llmModels]);
  const getModelLabel = useCallback(
    (provider?: string | null) => {
      if (!provider) return t("task.summaryModelAuto");
      const modelMeta = modelNameMap.get(provider);
      if (!modelMeta) return provider;
      return modelMeta.modelId
        ? `${modelMeta.displayName} / ${modelMeta.modelId}`
        : modelMeta.displayName;
    },
    [modelNameMap, t]
  );
  const renderModelOptions = useCallback(
    () =>
      modelGroups.map((group) => (
        <optgroup
          key={group.label}
          label={group.label}
        >
          {group.models.map((model) => {
            const suffix = model.is_available
              ? (model.is_recommended ? ` ${t("task.summaryModelRecommended")}` : "")
              : ` ${t("task.summaryModelUnavailable")}`;
            const label = model.model_id ? `  ${model.model_id}` : `  ${model.provider}`;
            return (
              <option
                key={model.model_id || model.provider}
                value={model.model_id || model.provider}
                disabled={!model.is_available}
              >
                {label}{suffix}
              </option>
            );
          })}
        </optgroup>
      )),
    [modelGroups, t]
  );
  const getModelKey = useCallback(
    (modelValue: string) => {
      const matched = llmModels.find(
        (model) => model.model_id === modelValue || model.provider === modelValue
      );
      if (matched) {
        return matched.model_id || matched.provider;
      }
      return modelValue;
    },
    [llmModels]
  );
  const getModelCompareLabel = useCallback(
    (modelKey: string) => {
      const modelMeta = modelNameMap.get(modelKey);
      if (!modelMeta) return modelKey;
      return modelMeta.modelId
        ? `${modelMeta.displayName} / ${modelMeta.modelId}`
        : modelMeta.displayName;
    },
    [modelNameMap]
  );
  const getCompareStatus = useCallback(
    (modelValue: string) => {
      const modelKey = getModelKey(modelValue);
      const result = comparisonResults.find((item) => getModelKey(item.model) === modelKey);
      return result?.status || "pending";
    },
    [comparisonResults, getModelKey]
  );
  const resolveModelPayload = useCallback(
    (modelValue: string) => {
      const matched = llmModels.find(
        (model) => model.model_id === modelValue || model.provider === modelValue
      );
      if (matched) {
        return {
          provider: matched.provider,
          model_id: matched.model_id ?? null,
        };
      }
      return {
        provider: modelValue,
        model_id: null,
      };
    },
    [llmModels]
  );
  const getStreamModelKey = useCallback(
    (payload: { provider?: string; model_id?: string } | null | undefined) => {
      if (!payload) return "";
      const rawKey = payload.model_id || payload.provider || "";
      return rawKey ? getModelKey(rawKey) : "";
    },
    [getModelKey]
  );
  const upsertComparisonResult = useCallback(
    (modelKey: string, updater: (prev: ComparisonResult) => ComparisonResult) => {
      setComparisonResults((prev) => {
        const index = prev.findIndex((item) => getModelKey(item.model) === modelKey);
        if (index >= 0) {
          const next = [...prev];
          next[index] = updater(next[index]);
          return next;
        }
        const base: ComparisonResult = {
          model: modelKey,
          content: "",
          token_count: null,
          created_at: new Date().toISOString(),
          status: "generating",
        };
        return [...prev, updater(base)];
      });
    },
    [getModelKey]
  );
  const compareDefaultSelection = useCallback(() => {
    const available = llmModels.filter((model) => model.is_available);
    const recommended = available.filter((model) => model.is_recommended);
    const picked = [...recommended, ...available]
      .map((model) => model.model_id || model.provider)
      .filter(Boolean)
      .filter((value, index, self) => self.indexOf(value) === index)
      .slice(0, 2);
    return picked;
  }, [llmModels]);
  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return null;
    const sizes = ["B", "KB", "MB", "GB"];
    const k = 1024;
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    const value = bytes / Math.pow(k, i);
    const formatted = i === 0 ? Math.round(value).toString() : value.toFixed(1);
    return `${formatted} ${sizes[i]}`;
  };
  const fileSizeLabel = formatFileSize(task?.file_size_bytes);
  const infoItems = [
    fileSizeLabel ? t("task.fileSizeValue", { size: fileSizeLabel }) : null,
    duration ? t("task.durationValue", { duration: formatDuration(Math.round(duration)) }) : null,
    task?.created_at ? formatRelativeTime(task.created_at) : null
  ].filter(Boolean) as string[];

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

  if (loading && !task) {
    return (
      <div className="h-screen flex flex-col" style={{ background: 'var(--app-bg)' }}>
        <Header
          isAuthenticated={!!session?.user}
          onOpenLogin={() => setLoginOpen(true)}
          onToggleTheme={onToggleTheme}
        />
        <div className="flex-1 flex overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-8">
            <div className="glass-panel rounded-lg p-6">
              <div className="text-sm" style={{ color: 'var(--app-text-muted)' }}>
                {t("errors.loadTaskDetail")}
              </div>
            </div>
          </main>
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
          onToggleTheme={onToggleTheme}
        />
        <div className="flex-1 flex items-center justify-center">
          <ErrorState
            type="general"
            title={t("errors.taskNotFound")}
            description={error || t("errors.taskNotFoundDesc")}
            onRetry={() => router.push('/tasks')}
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
                onClick={() => router.push('/tasks')}
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
              <div style={{ width: '140px' }}></div>
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
                  {isRetrying ? t("common.processing") : t("task.retryProcessing")}
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
                onClick={() => router.push('/tasks')}
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
                    {infoItems.length > 0 && (
                      <div className="flex items-center gap-3 mt-1">
                        {infoItems.map((item, index) => (
                          <span key={`${item}-${index}`} className="text-xs flex items-center gap-3" style={{ color: 'var(--app-text-subtle)' }}>
                            {item}
                            {index < infoItems.length - 1 && (
                              <span className="text-xs" style={{ color: 'var(--app-text-faint)' }}>·</span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Processing State */}
              <ProcessingState
                progress={progress}
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
      {/* Header */}
      <Header 
        isAuthenticated={!!session?.user}
        onOpenLogin={() => setLoginOpen(true)}
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
              onClick={() => router.push('/tasks')}
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

            <div className="flex items-center gap-3">
              <button
                onClick={() => setDeleteOpen(true)}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors hover:bg-[var(--app-danger-bg-soft)]"
                style={{ borderColor: 'var(--app-danger-border)', color: 'var(--app-danger)' }}
              >
                <span className="text-sm" style={{ fontWeight: 500 }}>{t("common.delete")}</span>
              </button>

              {/* Right: Export */}
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
          </div>

          {/* Player Section - YouTube integrated card or standard PlayerBar */}
          {task.source_type === 'youtube' && task.youtube_info ? (
            <YouTubePlayerCard
              youtubeInfo={task.youtube_info}
              sourceUrl={task.source_url}
              currentTime={displayCurrentTime}
              duration={duration}
              isPlaying={displayIsPlaying}
              onPlayPause={handlePlayPause}
              onSeek={handleSeek}
            />
          ) : (
            <div className="px-6 py-4" style={{ background: 'var(--app-glass-bg)' }}>
              <PlayerBar
                currentTime={displayCurrentTime}
                duration={duration}
                isPlaying={displayIsPlaying}
                onPlayPause={handlePlayPause}
                onSeek={handleSeek}
              />
            </div>
          )}

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
              <div className="flex-1 overflow-y-auto" ref={transcriptScrollRef}>
                {transcriptLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="glass-panel rounded-lg px-6 py-4 flex items-center gap-3">
                      <div
                        className="size-4 border-2 border-[var(--app-primary)] border-t-transparent rounded-full animate-spin"
                        style={{ borderColor: "var(--app-primary) transparent var(--app-primary) var(--app-primary)" }}
                      />
                      <span className="text-sm" style={{ color: "var(--app-text-muted)" }}>
                        {t("transcript.loading")}
                      </span>
                    </div>
                  </div>
                ) : transcript.length > 0 ? (
                  transcript.map((segment) => (
                    <div
                      key={segment.id}
                      ref={(node) => {
                        if (node) {
                          transcriptItemRefs.current.set(segment.id, node);
                        } else {
                          transcriptItemRefs.current.delete(segment.id);
                        }
                      }}
                    >
                      <TranscriptItem
                        speaker={segment.speaker}
                        startTime={segment.startTime}
                        endTime={segment.endTime}
                        content={segment.content}
                        words={segment.words}
                        avatarColor={segment.avatarColor}
                        isActive={segment.id === activeSegmentId}
                        activeWordIndex={
                          segment.id === activeWordKey?.segmentId ? activeWordKey.index : null
                        }
                        activeWordProgress={
                          segment.id === activeWordKey?.segmentId ? activeWordProgress : null
                        }
                        onTimeClick={handleTimeClick}
                        onEdit={(newContent) => handleEditTranscript(segment.id, newContent)}
                      />
                    </div>
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
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                        <div>
                          <h3 className="text-lg" style={{ fontWeight: 600, color: 'var(--app-text)' }}>
                            {t("task.summaryOverview")}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs" style={{ color: 'var(--app-text-subtle)' }}>
                              {t("task.summaryModelLabel")} {getModelLabel(summaryModelUsed.overview)}
                            </p>
                            <button
                              onClick={openCompareDialog}
                              disabled={llmModels.filter((model) => model.is_available).length < 2}
                              className="text-xs px-2 py-0.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{
                                background: 'var(--app-glass-bg-strong)',
                                color: 'var(--app-text)',
                                border: '1px solid var(--app-glass-border)',
                              }}
                            >
                              {t("task.compareModels")}
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={summaryModelSelection.overview ?? ''}
                            onChange={(event) =>
                              setSummaryModelSelection((prev) => ({
                                ...prev,
                                overview: event.target.value || null,
                              }))
                            }
                            disabled={summaryStreaming.overview || llmModels.length === 0}
                            className="text-xs px-2 py-1 rounded-md border bg-transparent disabled:opacity-50"
                            style={{ borderColor: 'var(--app-glass-border)', color: 'var(--app-text)' }}
                          >
                            <option value="">{t("task.summaryModelAutoOption")}</option>
                            {renderModelOptions()}
                          </select>
                          <button
                            onClick={() => regenerateSummary('overview')}
                            disabled={summaryStreaming.overview}
                            className="text-xs px-3 py-1 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: 'var(--app-primary-soft)', color: 'var(--app-primary)' }}
                          >
                            {summaryStreaming.overview ? t("task.summaryRetrying") : t("task.summaryRetry")}
                          </button>
                        </div>
                      </div>
                      {summaryStreaming.overview && summaryStreamContent.overview ? (
                        renderMarkdownContent(summaryStreamContent.overview)
                      ) : compareMode && compareSummaryType === "overview" ? (
                        renderCompareView()
                      ) : summaryOverviewMarkdown ? (
                        renderMarkdownContent(summaryOverviewMarkdown)
                      ) : (
                        <p className="text-base leading-7" style={{ color: 'var(--app-text-subtle)' }}>
                          {getSummaryEmptyText("overview", "task.summaryEmpty")}
                        </p>
                      )}
                    </div>

                  </div>
                )}

                {/* Key Points Tab */}
                {activeTab === 'keypoints' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg" style={{ fontWeight: 600, color: 'var(--app-text)' }}>
                          {t("task.keyPointsTitle")}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs" style={{ color: 'var(--app-text-subtle)' }}>
                            {t("task.summaryModelLabel")} {getModelLabel(summaryModelUsed.key_points)}
                          </p>
                          <button
                            onClick={openCompareDialog}
                            disabled={llmModels.filter((model) => model.is_available).length < 2}
                            className="text-xs px-2 py-0.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              background: 'var(--app-glass-bg-strong)',
                              color: 'var(--app-text)',
                              border: '1px solid var(--app-glass-border)',
                            }}
                          >
                            {t("task.compareModels")}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={summaryModelSelection.key_points ?? ''}
                          onChange={(event) =>
                            setSummaryModelSelection((prev) => ({
                              ...prev,
                              key_points: event.target.value || null,
                            }))
                          }
                          disabled={summaryStreaming.key_points || llmModels.length === 0}
                          className="text-xs px-2 py-1 rounded-md border bg-transparent disabled:opacity-50"
                          style={{ borderColor: 'var(--app-glass-border)', color: 'var(--app-text)' }}
                        >
                          <option value="">{t("task.summaryModelAutoOption")}</option>
                          {renderModelOptions()}
                        </select>
                        <button
                          onClick={() => regenerateSummary('key_points')}
                          disabled={summaryStreaming.key_points}
                          className="text-xs px-3 py-1 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ background: 'var(--app-primary-soft)', color: 'var(--app-primary)' }}
                        >
                          {summaryStreaming.key_points ? t("task.summaryRetrying") : t("task.summaryRetry")}
                        </button>
                      </div>
                    </div>
                    {summaryStreaming.key_points && summaryStreamContent.key_points ? (
                      renderMarkdownContent(summaryStreamContent.key_points)
                    ) : compareMode && compareSummaryType === "key_points" ? (
                      renderCompareView()
                    ) : keyPointsMarkdown ? (
                      // V1.2 format: Render full Markdown content
                      renderMarkdownContent(keyPointsMarkdown)
                    ) : keyPoints.length > 0 ? (
                      // Old format with time references
                      keyPoints.map((point, index) => (
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
                        ))
                    ) : (
                      <p className="text-base leading-7" style={{ color: 'var(--app-text-subtle)' }}>
                        {getSummaryEmptyText("key_points", "task.keyPointsEmpty")}
                      </p>
                    )}
                  </div>
                )}

                {/* Action Items Tab */}
                {activeTab === 'actions' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg" style={{ fontWeight: 600, color: 'var(--app-text)' }}>
                          {t("task.tabs.actions")}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs" style={{ color: 'var(--app-text-subtle)' }}>
                            {t("task.summaryModelLabel")} {getModelLabel(summaryModelUsed.action_items)}
                          </p>
                          <button
                            onClick={openCompareDialog}
                            disabled={llmModels.filter((model) => model.is_available).length < 2}
                            className="text-xs px-2 py-0.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              background: 'var(--app-glass-bg-strong)',
                              color: 'var(--app-text)',
                              border: '1px solid var(--app-glass-border)',
                            }}
                          >
                            {t("task.compareModels")}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={summaryModelSelection.action_items ?? ''}
                          onChange={(event) =>
                            setSummaryModelSelection((prev) => ({
                              ...prev,
                              action_items: event.target.value || null,
                            }))
                          }
                          disabled={summaryStreaming.action_items || llmModels.length === 0}
                          className="text-xs px-2 py-1 rounded-md border bg-transparent disabled:opacity-50"
                          style={{ borderColor: 'var(--app-glass-border)', color: 'var(--app-text)' }}
                        >
                          <option value="">{t("task.summaryModelAutoOption")}</option>
                          {renderModelOptions()}
                        </select>
                        <button
                          onClick={() => regenerateSummary('action_items')}
                          disabled={summaryStreaming.action_items}
                          className="text-xs px-3 py-1 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ background: 'var(--app-primary-soft)', color: 'var(--app-primary)' }}
                        >
                          {summaryStreaming.action_items ? t("task.summaryRetrying") : t("task.summaryRetry")}
                        </button>
                      </div>
                    </div>
                    {summaryStreaming.action_items && summaryStreamContent.action_items ? (
                      renderMarkdownContent(summaryStreamContent.action_items)
                    ) : compareMode && compareSummaryType === "action_items" ? (
                      renderCompareView()
                    ) : actionItemsMarkdown ? (
                      // V1.2 format: Render full Markdown content
                      renderMarkdownContent(actionItemsMarkdown)
                    ) : actionItems.length > 0 ? (
                      // Old format with task/assignee/deadline structure
                      actionItems.map((item) => (
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
                      ))
                    ) : (
                      <p className="text-base leading-7" style={{ color: 'var(--app-text-subtle)' }}>
                        {getSummaryEmptyText("action_items", "task.actionItemsEmpty")}
                      </p>
                    )}
                  </div>
                )}

                {/* Visual Summary Tabs */}
                {visualSummaries.map((summary) => {
                  const visualType = summary.summary_type.replace('visual_', '') as VisualType;
                  return (
                    activeTab === summary.summary_type && (
                      <div key={summary.summary_type} className="space-y-4">
                        <VisualSummaryView
                          taskId={id}
                          visualType={visualType}
                          renderMode="mermaid"
                          autoLoad={false}
                          initialData={summary}
                        />
                      </div>
                    )
                  );
                })}
              </div>

              {compareDialogOpen && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                  style={{ background: 'rgba(15, 23, 42, 0.6)' }}
                  onClick={() => setCompareDialogOpen(false)}
                >
                  <div
                    className="glass-panel-strong w-full max-w-lg rounded-2xl p-6 space-y-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg" style={{ fontWeight: 600, color: 'var(--app-text)' }}>
                        {t("task.compareTitle")}
                      </h3>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--app-text-subtle)' }}>
                      {t("task.compareHint")}
                    </p>

                    <div className="space-y-3">
                      {modelGroups.map((group) => (
                        <div key={group.label} className="space-y-2">
                          <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--app-text-muted)' }}>
                            {group.label}
                          </div>
                          <div className="space-y-2">
                            {group.models.map((model) => {
                              const value = model.model_id || model.provider;
                              const isChecked = compareSelectedModels.includes(value);
                              const suffix = model.is_available
                                ? (model.is_recommended ? ` ${t("task.summaryModelRecommended")}` : "")
                                : ` ${t("task.summaryModelUnavailable")}`;
                              return (
                                <label
                                  key={value}
                                  className="flex items-center gap-2 text-sm"
                                  style={{ color: model.is_available ? 'var(--app-text)' : 'var(--app-text-subtle)' }}
                                >
                                  <input
                                    type="checkbox"
                                    disabled={!model.is_available}
                                    checked={isChecked}
                                    onChange={() => toggleCompareModel(value)}
                                  />
                                  <span>{model.model_id ? `${model.model_id}${suffix}` : `${model.provider}${suffix}`}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    {compareError && (
                      <p className="text-sm" style={{ color: 'var(--app-danger)' }}>
                        {compareError}
                      </p>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => setCompareDialogOpen(false)}
                        className="text-sm px-4 py-2 rounded-lg"
                        style={{ background: 'var(--app-glass-bg-strong)', color: 'var(--app-text-muted)' }}
                      >
                        {t("common.cancel")}
                      </button>
                      <button
                        onClick={() => {
                          setCompareDialogOpen(false);
                          startCompare();
                        }}
                        disabled={compareSelectedModels.length < 2 || compareLoading}
                        className="text-sm px-4 py-2 rounded-lg disabled:opacity-50"
                        style={{ background: 'var(--app-primary)', color: 'var(--app-button-primary-text)' }}
                      >
                        {compareLoading ? t("task.compareLoadingButton") : t("task.compareStart")}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteOpen(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("task.deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("task.deleteConfirmDesc")}
              {task?.title && (
                <span
                  className="mt-2 block text-sm font-medium"
                  style={{ color: "var(--app-text)" }}
                >
                  {task.title}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteTask}
              disabled={isDeleting}
            >
              {isDeleting ? t("task.deleteProcessing") : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
