"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { notifyError, notifySuccess } from '@/lib/notify';
import { useUIStore } from '@/store/ui-store';
import { DeleteTaskDialog } from '@/components/task/DeleteTaskDialog';
import { CompareModelDialog } from '@/components/task/CompareModelDialog';
import { PlayerBarContainer } from '@/components/task/PlayerBarContainer';
import { TranscriptList } from '@/components/task/TranscriptList';
import type { DisplayTranscriptSegment } from '@/lib/transcript-mapping';
import { type ActionItem, parseActionItems, parseSummaryLines } from '@/lib/summary-parse';
import { ExportMenu } from '@/components/task/ExportMenu';
import { TaskVisibilityToggle } from '@/components/task/TaskVisibilityToggle';
import { TaskDetailHeader } from '@/components/task/TaskDetailHeader';
import { TaskFailedView } from '@/components/task/TaskFailedView';
import { TaskProcessingPanel } from '@/components/task/TaskProcessingPanel';
import { TranscriptColumnHeader } from '@/components/task/TranscriptColumnHeader';
import ErrorState from '@/components/common/ErrorState';
import { ProvenanceBadge } from '@/components/common/ProvenanceBadge';
import { formatAsrProvenance } from '@/lib/provenance';
import RetryCleanupToast from '@/components/task/RetryCleanupToast';
import { useAPIClient } from '@/lib/use-api-client';
import { useGlobalStore } from '@/store/global-store';
import { setEnsureCurrentMedia, useAudioStore } from '@/store/audio-store';
import { useMediaToken } from '@/lib/media-url';
import { ApiError } from '@/types/api';
import { formatDuration } from '@/lib/utils';
import type {
  TaskDetail as ApiTaskDetail,
  TranscriptSegment as ApiTranscriptSegment,
  SummaryItem,
  SummaryRegenerateType,
  LLMModel,
  SummaryStyleItem,
  TaskStatus,
} from '@/types/api';
import {
  buildStreamingImagesFromSummaryOrSeed,
  mergeStreamingImages,
} from '@/lib/summary-images';
import { useI18n } from '@/lib/i18n-context';
import { useDateFormatter } from '@/lib/use-date-formatter';
import { mapApiTranscript as mapApiTranscriptUtil } from '@/lib/transcript-mapping';
import { SummaryTabPanel } from '@/components/task/SummaryTabPanel';
import { useSummaryCompare } from '@/hooks/use-summary-compare';
import { useSummaryRegeneration } from '@/hooks/use-summary-regeneration';
import { useSummaryImages } from '@/hooks/use-summary-images';

interface KeyPoint {
  text: string;
  timeReference: string;
}

interface Speaker {
  name: string;
  color: string;
}

export default function TaskDetail() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const authUser = useAuthStore((s) => s.user);
  const sessionStatus = useAuthStore((s) => s.status);
  const client = useAPIClient();
  const { t, locale } = useI18n();
  const { formatRelativeTime } = useDateFormatter();
  const id = params?.id as string;

  // 返回任务列表：带回来源搜索词(?q=,由列表跳转时注入到详情 URL)让列表恢复搜索态;无来源 q 则回纯列表。
  // 用 push(明确目标)而非 router.back():back 在「详情→详情」历史下会回错页,破坏确定性的「回列表」语义。
  const handleBackToTasks = useCallback(() => {
    const q = searchParams?.get('q')?.trim();
    router.push(q ? `/tasks?q=${encodeURIComponent(q)}` : '/tasks');
  }, [router, searchParams]);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const audioDuration = useAudioStore((state) => state.duration);
  const currentSrc = useAudioStore((state) => state.src);
  const setSource = useAudioStore((state) => state.setSource);
  const togglePlayback = useAudioStore((state) => state.toggle);
  const play = useAudioStore((state) => state.play);
  const seek = useAudioStore((state) => state.seek);
  // 文章内联图 / 生成图走鉴权代理；<img> 不能带 Authorization 头，故附加 ?token=
  const mediaToken = useMediaToken();
  const openLogin = useUIStore((s) => s.openLogin);
  const [activeTab, setActiveTab] = useState('summary');
  const [progress, setProgress] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showCleanupToast, setShowCleanupToast] = useState(false);
  const [failedTaskIds, setFailedTaskIds] = useState<string[]>([]);
  const [isCleaning, setIsCleaning] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [task, setTask] = useState<ApiTaskDetail | null>(null);
  const [transcript, setTranscript] = useState<DisplayTranscriptSegment[]>([]);
  const [transcriptLoading, setTranscriptLoading] = useState(true);
  // 转写「这一次」拉取是否出错（瞬态：超时/网络/网关，非 40401「尚未就绪」）。
  // 用于让面板区分「加载失败可重试」与「确实暂无内容」，不再一律显示「任务处理失败」。
  const [transcriptError, setTranscriptError] = useState(false);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [keyPoints, setKeyPoints] = useState<KeyPoint[]>([]);
  const [summaryOverviewMarkdown, setSummaryOverviewMarkdown] = useState<string>('');
  const [keyPointsMarkdown, setKeyPointsMarkdown] = useState<string>('');
  const [actionItemsMarkdown, setActionItemsMarkdown] = useState<string>('');
  const [summaryModelUsed, setSummaryModelUsed] = useState<Record<SummaryRegenerateType, string | null>>({
    overview: null,
    key_points: null,
    action_items: null,
  });
  const [imageModelUsed, setImageModelUsed] = useState<string | null>(null);
  const [summaryVersions, setSummaryVersions] = useState<Record<SummaryRegenerateType, number>>({
    overview: 0,
    key_points: 0,
    action_items: 0,
  });
  // 配图状态簇(streamingImages useState + imagesTimeoutRef + WS drain / 90s 兜底 / 4s 对账三 effect)
  // 抽入 useSummaryImages;同名解构使 useSummaryRegeneration 注入与 loadTask 种子写、渲染读零改动。
  const { streamingImages, setStreamingImages, imagesTimeoutRef } = useSummaryImages({
    taskId: id,
    taskStatus: task?.status,
    client,
  });
  // Summary scroll auto-follow refs
  const summaryScrollRef = useRef<HTMLDivElement | null>(null);
  const summaryAutoScrollRef = useRef(true);
  const [llmModels, setLlmModels] = useState<LLMModel[]>([]);
  const [summaryStyles, setSummaryStyles] = useState<SummaryStyleItem[]>([]);
  const [summaryModelSelection, setSummaryModelSelection] = useState<Record<SummaryRegenerateType, string | null>>({
    overview: null,
    key_points: null,
    action_items: null,
  });
  // loadTask 代际计数:防旧响应乱序覆盖(mount 拉取 vs completed 重载 vs 手动重试并发时,
  // 慢隧道下窗口很大)。调用头取代,所有 await 之后的 setState 出口前校验,过期整段丢弃。
  // 同款模式见 PublicTaskDetail 的 per-loader 代际 ref。
  const loadTaskGenRef = useRef(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 右栏摘要局部错误：摘要文字失败时 task 仍 completed，仅右栏报错、不连带藏转写左栏。
  const [summaryError, setSummaryError] = useState<string | null>(null);
  // 转写尚不可见的早期阶段才走全屏进度页；进入 polishing/summarizing 后转写已落库可取，
  // 改为挂载主布局、左栏直出转写、右栏显示「摘要生成中」（渐进式展示）。
  const TRANSCRIPT_VISIBLE_STAGES: TaskStatus[] = ['polishing', 'summarizing'];
  const transcriptStageReached = task?.status
    ? TRANSCRIPT_VISIBLE_STAGES.includes(task.status)
    : false;
  const isProcessingTask = task?.status
    ? !['completed', 'failed'].includes(task.status) && !transcriptStageReached
    : false;
  // 转写面板挂载后（polishing/summarizing 或 completed），任务若仍未完成即「转写生成中」。
  // 此阶段转写可能尚未产出，后端对处理中任务返回 empty-success(items=[]) 而非 40401，
  // 若不识别就会落到「暂无内容/加载失败」空态。据 task.status 派生此标记交给 TranscriptList
  // 优先显示「转写生成中」，避免在任务尚未完成时把空态冤枉成失败。
  const transcriptInProgress = task?.status
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

  // 把后端转写 items 映射为展示分段（含 speaker 调色板按出现顺序分配）。
  // loadTask 与「进入可见阶段补拉转写」复用同一映射，避免重复。
  const mapApiTranscript = useCallback((items: ApiTranscriptSegment[]): DisplayTranscriptSegment[] => {
    const unknownSpeakerLabel = t("transcript.unknownSpeaker");
    return mapApiTranscriptUtil(items, availableSpeakers, unknownSpeakerLabel);
  }, [availableSpeakers, t]);

  // 行动项缺省占位文案（已本地化）；解析逻辑见 @/lib/summary-parse。
  const actionItemLabels = useMemo(
    () => ({
      pendingAssignee: t("task.pendingAssignee"),
      pendingDeadline: t("task.pendingDeadline"),
    }),
    [t]
  );

  const buildSummaryState = useCallback((items: SummaryItem[]) => {
    const overview = items.find((item) => item.summary_type === 'overview' && item.is_active)?.content;
    const keyPointsContent = items.find((item) => item.summary_type === 'key_points' && item.is_active)?.content;
    const actionItemsContent = items.find((item) => item.summary_type === 'action_items' && item.is_active)?.content;

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
    const actionLines = parseActionItems(actionItemsContent, actionItemLabels);

    setKeyPoints(keyPointLines.map((text) => ({
      text,
      timeReference: '--:--',
    })));

    setActionItems(actionLines);

    setSummaryVersions(latestVersions);
    setSummaryModelUsed(modelUsed);
    setImageModelUsed(
      items.find((item) => item.summary_type === 'overview' && item.is_active)?.image_model_used ?? null
    );
  }, [actionItemLabels]);

  const {
    compareMode, compareSummaryType, compareDialogOpen, compareSelectedModels,
    compareError, compareLoading, compareActiveModel, comparisonResults, compareActivating,
    modelGroups,
    openCompareDialog, toggleCompareModel, startCompare, clearCompare, activateComparisonResult,
    getModelKey, getCompareStatus, getModelCompareLabel,
    setCompareDialogOpen, setCompareActiveModel,
  } = useSummaryCompare({ taskId: id, llmModels, activeTab, buildSummaryState });

  const { summaryStreaming, summaryStreamContent, regenerateSummary } = useSummaryRegeneration({
    taskId: id,
    llmModels,
    summaryModelSelection,
    summaryVersions,
    actionItemLabels,
    buildSummaryState,
    setStreamingImages,
    imagesTimeoutRef,
    setSummaryError,
    summaryScrollRef,
    summaryAutoScrollRef,
    setSummaryOverviewMarkdown,
    setKeyPointsMarkdown,
    setKeyPoints,
    setActionItemsMarkdown,
    setActionItems,
  });

  // opts.silentTranscript：静默刷新转写——保留已显示的转写、不亮 loading spinner，待数据回来原位替换。
  // 仅 completed 同步重拉用（此时转写已显示，只需把原始版换成润色版，不应整列清空+闪 spinner）；
  // mount/retry 仍走默认(false)：清空+亮 loading，保留首屏 spinner 语义。
  const loadTask = useCallback(async (opts?: { silentTranscript?: boolean }) => {
    if (!id || !authUser) return;
    const silentTranscript = opts?.silentTranscript ?? false;
    const gen = ++loadTaskGenRef.current;
    setLoading(true);
    setError(null);
    setSummaryError(null);
    if (!silentTranscript) {
      setTranscriptLoading(true);
      setTranscript([]);
    }
    setTranscriptError(false);

    // 三请求同拍发出：每个请求经隧道 ~1.5s 基线，旧的「先 getTask、成功后再拉另两路」串行瀑布
    // 白付一整段。transcript/summary 发出即各自 .catch 收编为值：既保持「各自独立成败、互不连带」，
    // 也保证 getTask 失败整段早退时这两路不产生 unhandled rejection。
    const taskPromise = client.getTask(id);
    // catch 回调归一化为 ApiError（标注返回类型让 promise 推断回 Promise<XxxResponse | ApiError>，
    // 不丢静态检查）；api-client 正常只抛 ApiError，归一化兜的是理论上的非 ApiError 异常。
    const toApiError = (err: unknown): ApiError =>
      err instanceof ApiError ? err : new ApiError(0, err instanceof Error ? err.message : String(err), "");
    const transcriptPromise = client.getTranscript(id).catch(toApiError);
    const summaryPromise = client.getSummary(id).catch(toApiError);

    try {
      try {
        const taskData = await taskPromise;
        if (gen !== loadTaskGenRef.current) return;
        setTask(taskData);
        setProgress(taskData.progress ?? 0);
      } catch (err) {
        // getTask 失败 = 任务级失败（401→登录、其余→整页错误态），整体丢弃 transcript/summary
        // 两路的结果与错误：直接 return，不 setState、不 toast、不进其局部错误分支
        //（否则 401 时会三连 toast）。两路 promise 已被上面的 .catch 收编，丢弃无副作用。
        if (gen !== loadTaskGenRef.current) return;
        if (err instanceof ApiError) {
          setError(err.message);
          notifyError(err.message);
          if (err.code >= 40100 && err.code < 40200) {
            openLogin();
          }
        } else {
          const message = err instanceof Error ? err.message : t("errors.loadTaskFailed");
          setError(message);
          notifyError(message);
        }
        return;
      }

      // 转写与摘要解耦：各自独立成败，互不连带（错误已在发出处收编为值，这里只等结果）。
      const [transcriptResult, summaryResult] = await Promise.all([transcriptPromise, summaryPromise]);
      if (gen !== loadTaskGenRef.current) return;

      if (transcriptResult instanceof ApiError) {
        // silent 模式（completed 同步重拉）下这一次没拉到：静默保持已显示的旧转写，
        // 不清空、不报「加载失败」——否则会把已显示转写的已完成任务从列表跳成 PR#64 要避免的误报。
        if (!silentTranscript) {
          // 40401 = 转写尚未就绪（任务还在处理早期），静默置空、不算错误。
          // 其它（含 50000 超时/网络/网关瞬态）= 这一次没拉到，标记 transcriptError 让面板显示
          // 「加载失败可重试」，而不是把已完成任务一律冤枉成「任务处理失败」。
          if (transcriptResult.code !== 40401) {
            notifyError(transcriptResult.message);
            setTranscriptError(true);
          }
          setTranscript([]);
        }
      } else if (transcriptResult) {
        // 成功：无论是否 silent 都原位替换（行 key=segment.id，润色为就地改同一行、id 不变，
        // React 仅重渲染内容变化的行、不整列重挂，故 silent 下不闪烁）。
        setTranscript(mapApiTranscript(transcriptResult.items));
      }

      if (summaryResult instanceof ApiError) {
        // 摘要未就绪（40401）= 还没生成，静默置空；其它 = 右栏局部报错（不藏转写、不整页失败）。
        if (summaryResult.code === 40401) {
          setKeyPoints([]);
          setActionItems([]);
          setSummaryOverviewMarkdown('');
        } else {
          setSummaryError(summaryResult.message);
        }
      } else if (summaryResult) {
        buildSummaryState(summaryResult.items);
        // 渐进式展示：用持久图集 summary.images 初始化/刷新占位符 Map（替代旧的「仅 regenerate 临时填充」）。
        // 用 merge 而非整体替换：completed 重载重拉 summary.images 时，DB 快照可能滞后于已到达的
        // image_ready WS（本地某占位符已 patch 成 ready），直接替换会把已显示的图退回 pending 且不重放。
        // images[] 优先；completed 那刻它偶发还没落库时，从 overview 正文占位符兜底 seed 成 pending，
        // 保证对账轮询能武装、把异步生成的图补出来（不必手刷）。
        const dbImages = buildStreamingImagesFromSummaryOrSeed(summaryResult.items);
        setStreamingImages((prev) => mergeStreamingImages(prev, dbImages));
      }
    } finally {
      // 统一收尾（蓝本 PublicTaskDetail 同款 finally+代际校验）：只有仍是最新代际才清 loading——
      // 过期代际绝不能清（守卫 return 时必有更新调用在跑，清了会打掉它刚亮起的 spinner，
      // 由那次调用自己的 finally 负责）；finally 同时兜住结果处理中途抛异常时 spinner 卡死。
      if (gen === loadTaskGenRef.current) {
        setLoading(false);
        if (!silentTranscript) setTranscriptLoading(false);
      }
    }
  }, [buildSummaryState, client, id, authUser, t, mapApiTranscript]);

  // 方案B「提早整块」：转写在进入 polishing/summarizing 时其实已全量落库（ASR 批量、转写写完才进润色），
  // 但 loadTask 只在 mount/completed 触发，live 观看的任务在这一阶段不会自动取到已就绪的转写，
  // 只能停在「转写生成中」直到 completed。这里在「转写可见阶段」补拉一次转写（仅转写、不动摘要），
  // 让完整转写在润色/摘要还在跑时就先显示出来，无需等到 completed；completed 时 loadTask 会再拉到最终润色版。
  useEffect(() => {
    if (!id || !transcriptStageReached) return;
    // 已有转写 / 正在加载 / 这一次明确出错 时都不补拉：避免覆盖、避免与 loadTask 抢、出错保持「生成中」。
    if (transcript.length > 0 || transcriptLoading || transcriptError) return;
    let cancelled = false;
    void (async () => {
      const result = await client.getTranscript(id).catch((err) => err);
      // 处理中阶段取不到（尚未就绪/瞬态）属正常，不报错——保持「转写生成中」，completed 时 loadTask 兜底。
      if (cancelled || result instanceof ApiError) return;
      if (result?.items?.length) {
        setTranscript(mapApiTranscript(result.items));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, transcriptStageReached, transcript.length, transcriptLoading, transcriptError, client, mapApiTranscript]);

  // audio_url 与 ASR 溯源同理：都写在处理中途（audio_url 在 upload_storage、asr_provider/engine/variant
  // 在 transcribe），但 WS 推送只带 status/progress，不带它们，且 loadTask 只在 mount/completed 触发——
  // live 观看的任务在 polishing/summarizing 阶段不会自动取到。表现：YouTube 任务 mount 时 audio_url 为 null
  // 点播放无反应（要到 completed 才能播）；ASR「由X转写」徽章要等摘要(completed)才显示。进入「转写可见阶段」
  // 时音频与 ASR 必已落库，这里补拉一次 task 把这些中途字段一并就位，无需等 completed。
  // 同理还有 detected_summary_style（summarizing 即落库,auto 风格任务的「识别风格」标签）：它写在
  // completed 之前、不进 WS 信封、进度白名单不并入，原先要等 completed 全量重拉才显示。一并在
  // 此补拉就位。detected_summary_style 仅 auto 任务有,非 auto 任务它恒缺；但 deps 只引用具体
  // 字段（各自只发生一次 undefined→值 的迁移）,无新值时不再 setTask、deps 不变 → effect 自然收敛,
  // 不会反复重跑。
  useEffect(() => {
    if (!id || !transcriptStageReached) return;
    if (task?.audio_url && task?.asr_provider && task?.detected_summary_style) return; // 全部就位则不补拉
    let cancelled = false;
    void (async () => {
      const refreshed = await client.getTask(id).catch(() => null);
      if (cancelled || !refreshed) return;
      const needAudio = !task?.audio_url && !!refreshed.audio_url;
      const needAsr = !task?.asr_provider && !!refreshed.asr_provider;
      const needStyle = !task?.detected_summary_style && !!refreshed.detected_summary_style;
      if (!needAudio && !needAsr && !needStyle) return;
      // 仅补这些中途字段，不整体覆盖（status 由上面的 sync effect 维持为 WS 最新值）。
      setTask((prev) =>
        prev
          ? {
              ...prev,
              ...(needAudio ? { audio_url: refreshed.audio_url } : {}),
              ...(needAsr
                ? {
                    asr_provider: refreshed.asr_provider,
                    asr_engine: refreshed.asr_engine,
                    asr_variant: refreshed.asr_variant,
                  }
                : {}),
              ...(needStyle
                ? { detected_summary_style: refreshed.detected_summary_style }
                : {}),
            }
          : prev
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [
    id,
    transcriptStageReached,
    task?.audio_url,
    task?.asr_provider,
    task?.detected_summary_style,
    client,
  ]);

  useEffect(() => {
    if (authUser) {
      loadTask();
    }
  }, [loadTask, authUser]);

  useEffect(() => {
    if (!authUser) return;
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
  }, [client, locale, authUser]);

  useEffect(() => {
    if (!authUser) return;
    let active = true;
    const loadSummaryStyles = async () => {
      try {
        const result = await client.getSummaryStyles();
        if (active) {
          setSummaryStyles(result.styles || []);
        }
      } catch {
        if (active) {
          setSummaryStyles([]);
        }
      }
    };
    loadSummaryStyles();
    return () => {
      active = false;
    };
  }, [client, locale, authUser]);

  // Detect user scroll in summary container to pause/resume auto-scroll
  useEffect(() => {
    const container = summaryScrollRef.current;
    if (!container) return;

    const handleUserScroll = () => {
      // Check if user is near the bottom (within 50px)
      const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
      summaryAutoScrollRef.current = isAtBottom;
    };

    container.addEventListener('scroll', handleUserScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleUserScroll);
  }, []);

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
              // 标题随进度实时刷新：后端在下载阶段即经 task_progress.task_title 早早广播真实标题，
              // 当场并入即可，无需等 completed 全量重拉。仅在 store 带到标题时覆盖，否则保留已有标题。
              title: globalTaskState.title ?? prev.title,
            }
          : prev
      );

      // Reload task data when completed to get transcript and summary.
      // 静默刷新转写：completed 时转写已显示，只需把原始版换成润色版，不要清空+闪 spinner（见 loadTask 注释）。
      if (globalTaskState.status === 'completed' && task?.status !== 'completed') {
        loadTask({ silentTranscript: true });
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

  const handlePlayPause = useCallback(() => {
    if (!task?.audio_url) return;
    if (currentSrc !== task.audio_url) {
      setSource(task.audio_url, task.id, task.title);
      play();
      return;
    }
    togglePlayback();
  }, [task?.audio_url, task?.id, task?.title, currentSrc, setSource, play, togglePlayback]);

  const handleSeek = useCallback((time: number) => {
    if (task?.audio_url && currentSrc !== task.audio_url) {
      setSource(task.audio_url, task.id, task.title);
    }
    seek(time);
  }, [task?.audio_url, task?.id, task?.title, currentSrc, setSource, seek]);

  // 全局键盘快捷键（空格切播放、方向键 seek）默认作用于顶部播放条载入的音频。停留在本任务详情页
  // 时登记此回调，让快捷键改作用于本任务：store 当前源不是本任务音频则先切源（随后 toggle 即播本
  // 任务），修复「顶部播放条载着别的任务时，在本任务页按空格却播了别的任务」。卸载时清空、回落全局。
  const ensureCurrentMedia = useCallback(() => {
    if (!task?.audio_url) return;
    if (useAudioStore.getState().src !== task.audio_url) {
      setSource(task.audio_url, task.id, task.title);
    }
  }, [task?.audio_url, task?.id, task?.title, setSource]);

  useEffect(() => {
    setEnsureCurrentMedia(ensureCurrentMedia);
    return () => setEnsureCurrentMedia(null);
  }, [ensureCurrentMedia]);

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

  const handleTimeClick = useCallback((time: string) => {
    // Convert time string to seconds
    const [mins, secs] = time.split(':').map(Number);
    if (Number.isNaN(mins) || Number.isNaN(secs)) return;
    const totalSeconds = mins * 60 + secs;
    handleSeek(totalSeconds);
  }, [handleSeek]);

  // 从转写全文搜索命中跳转过来时 URL 带 ?t=<秒>：媒体就绪后跳播到该时刻一次。store.seek 即便
  // 音频元素尚未就绪也会落 currentTime，进而驱动 TranscriptList 滚动/高亮到对应句子。只触发一次
  // （ref 守卫），避免用户在页面内手动 seek 后被深链反复拉回。
  const deepLinkSeekedRef = useRef(false);
  useEffect(() => {
    if (deepLinkSeekedRef.current) return;
    if (!task?.audio_url) return;
    const raw = searchParams?.get('t');
    if (raw == null) return;
    const seconds = Number(raw);
    if (!Number.isFinite(seconds) || seconds < 0) return;
    deepLinkSeekedRef.current = true;
    // 深链「跳到这一句」是显式意图，须压过 localStorage 保存的播放进度：先删掉本任务的进度缓存，
    // 让 GlobalAudioPlayer 的进度恢复 effect 读到空缓存即早返回、不写 currentTime；否则它会先把
    // 进度恢复到上次位置(滚动一次到错位置)，深链 seek 再写一次(滚动到目标)——双重滚动。删缓存后
    // 深链 seek 成为唯一的 currentTime 写入，单次滚动落到目标句。key 与 GlobalAudioPlayer 持久化
    // 所用的 `audio:progress:${store.taskId}` 一致(store.taskId 由 setSource 取 task.id)。
    try {
      localStorage.removeItem(`audio:progress:${task.id}`);
    } catch {
      // 忽略存储异常(隐私模式/配额)，不影响跳播本身。
    }
    handleSeek(seconds);
  }, [task?.audio_url, task?.id, searchParams, handleSeek]);

  const handleEditTranscript = useCallback(async (segmentId: string, newContent: string) => {
    // 乐观更新:立即显示新内容并标记「已编辑」(isPolished 映射自后端 is_edited),同时
    // 捕获旧段用于失败回滚。updater 在本次提交阶段同步执行,远早于网络响应,previous 必被赋值。
    let previous: DisplayTranscriptSegment | undefined;
    setTranscript(prev =>
      prev.map(segment => {
        if (segment.id === segmentId) {
          previous = segment;
          return { ...segment, content: newContent, isPolished: true };
        }
        return segment;
      })
    );
    try {
      const updated = await client.updateTranscriptSegment(id, segmentId, newContent);
      // 用服务端真值同步展示字段(不整段重映射,避免 speaker 配色等抖动)
      setTranscript(prev =>
        prev.map(segment =>
          segment.id === segmentId
            ? {
                ...segment,
                content: updated.content,
                isPolished: updated.is_edited,
                originalContent: updated.original_content,
              }
            : segment
        )
      );
      notifySuccess(t('transcript.editSaved'));
    } catch (err) {
      // 保存失败:回滚到编辑前并提示(读回路径不再抹掉编辑,因为根本没落库成功)
      if (previous) {
        const restored = previous;
        setTranscript(prev =>
          prev.map(segment => (segment.id === segmentId ? restored : segment))
        );
      }
      notifyError(err instanceof Error ? err.message : t('transcript.editSaveFailed'));
    }
  }, [client, id, t]);

  // TranscriptList 已 memo:onRetry 若内联箭头,每次渲染都是新引用会击穿 memo
  //(SSE 流式期间父组件每次 flush 都重渲染,1700+ 行整列 reconcile 就回来了)。
  const handleTranscriptRetry = useCallback(() => {
    void loadTask();
  }, [loadTask]);

  const isActiveAudio = Boolean(task?.audio_url && currentSrc === task.audio_url);
  // 优先使用音频元素的实际 duration，如果没有则使用后端提供的 duration_seconds
  const duration = isActiveAudio
    ? (audioDuration || task?.duration_seconds || 0)
    : (task?.duration_seconds || 0);
  const displayIsPlaying = isActiveAudio ? isPlaying : false;

  const toggleActionItem = (itemId: string) => {
    setActionItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      )
    );
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

    return baseTabs;
  }, [t]);
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
  // 摘要模型溯源徽章:有记录→胶囊徽章(可见短名=displayName,悬浮明细=displayName / modelId);
  // 未记录(null)→沿用「自动选择」纯文本(非溯源场景,不显示徽章)。
  const renderModelProvenance = useCallback(
    (provider?: string | null) => {
      if (!provider) {
        return (
          <span className="text-xs" style={{ color: 'var(--app-text-subtle)' }}>
            {t("task.summaryModelAuto")}
          </span>
        );
      }
      const modelMeta = modelNameMap.get(provider);
      const label = modelMeta?.displayName || provider;
      return <ProvenanceBadge label={label} tooltip={getModelLabel(provider)} />;
    },
    [modelNameMap, getModelLabel, t]
  );
  // ASR 转写来源:据 task.asr_provider 派生 provider 本地化显示名,用于「本次内容转写能力由 X 提供」
  // 一句淡色文案(非徽章、无 hover);旧任务 asr_provider 为 NULL→不渲染。engine/variant 这类技术明细
  // 对普通用户无意义,不再展示。
  const asrProviderName = useMemo(() => {
    if (!task) return null;
    const parts = formatAsrProvenance(
      { provider: task.asr_provider },
      (provider) => {
        const key = `task.asrProviderNames.${provider}`;
        const name = t(key);
        return name === key ? undefined : name;
      }
    );
    return parts?.label ?? null;
  }, [task, t]);
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
      <div className="h-full flex items-center justify-center" style={{ background: 'var(--app-bg)' }}>
        <div className="text-sm" style={{ color: 'var(--app-text-muted)' }}>
          {t("common.loading")}...
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="h-full flex items-center justify-center">
        <ErrorState
          type="general"
          title={t("errors.loginToViewTitle")}
          description={t("errors.loginToViewDesc")}
          onRetry={() => openLogin()}
          retryLabel={t("errors.retryLogin")}
        />
      </div>
    );
  }

  if (loading && !task) {
    return (
      <div className="p-8">
        <div className="glass-panel rounded-lg p-6">
          <div className="text-sm" style={{ color: 'var(--app-text-muted)' }}>
            {t("errors.loadTaskDetail")}
          </div>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="h-full flex items-center justify-center">
        <ErrorState
          type="general"
          title={t("errors.taskNotFound")}
          description={error || t("errors.taskNotFoundDesc")}
          onRetry={handleBackToTasks}
          retryLabel={t("errors.backHome")}
        />
      </div>
    );
  }

  if (task.status === 'failed') {
    return (
      <TaskFailedView
        task={task}
        onBack={handleBackToTasks}
        onRetry={handleRetry}
        isRetrying={isRetrying}
        onConfirmDelete={handleDeleteTask}
        isDeleting={isDeleting}
      />
    );
  }

  if (isProcessingTask) {
    return (
      <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--app-page-gradient)' }}>
            <TaskDetailHeader
              withBackground
              title={task.title}
              onBack={handleBackToTasks}
              right={<div style={{ width: '100px' }} />}
            />

            <TaskProcessingPanel
              task={task}
              infoItems={infoItems}
              progress={progress}
              estimatedTime={getEstimatedTime()}
            />
      </div>
    );
  }

  const detectedStyleName =
    task?.detected_summary_style
      ? (summaryStyles.find((s) => s.id === task.detected_summary_style)?.name ?? null)
      : null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
          <TaskDetailHeader
            title={task.title}
            onBack={handleBackToTasks}
            right={
              <div className="flex items-center gap-3">
                <TaskVisibilityToggle
                  taskId={task.id}
                  status={task.status}
                  isPublic={Boolean(task.is_public)}
                  onChanged={(isPublic, publishedAt) =>
                    setTask((prev) => (prev ? { ...prev, is_public: isPublic, published_at: publishedAt } : prev))
                  }
                />
                <button
                  onClick={() => setDeleteOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors hover:bg-[var(--app-danger-bg-soft)]"
                  style={{ borderColor: 'var(--app-danger-border)', color: 'var(--app-danger)' }}
                >
                  <span className="text-sm" style={{ fontWeight: 500 }}>{t("common.delete")}</span>
                </button>
                <ExportMenu
                  label={t("task.export")}
                  items={[
                    { key: "pdf", label: t("task.exportPdf") },
                    { key: "word", label: t("task.exportWord") },
                    { key: "markdown", label: t("task.exportMarkdown") },
                  ]}
                />
              </div>
            }
          />

          {/* Player Section - 进度条逐帧订阅 currentTime，下沉到 PlayerBarContainer 叶子组件，避免父组件每秒重渲染 */}
          <PlayerBarContainer
            isActiveAudio={isActiveAudio}
            duration={duration}
            isPlaying={displayIsPlaying}
            onPlayPause={handlePlayPause}
            onSeek={handleSeek}
            youtube={
              task.source_type === 'youtube' && task.youtube_info
                ? { youtubeInfo: task.youtube_info, sourceUrl: task.source_url }
                : null
            }
          />

          {/* Two Column Layout */}
          <div className="flex-1 flex overflow-hidden border-t" style={{ borderColor: 'var(--app-glass-border)' }}>
            {/* Left Column: Transcript */}
            <div className="flex-1 flex flex-col border-r" style={{ borderColor: 'var(--app-glass-border)' }}>
              <TranscriptColumnHeader title={t("task.transcriptTitle")} asrProviderName={asrProviderName ?? undefined} />

              {/* Transcript List - currentTime 逐帧订阅 + 高亮派生 + 自动滚动均封装在 TranscriptList 内，配合行级 memo 把逐帧重渲染限制在高亮行 */}
              <TranscriptList
                transcript={transcript}
                transcriptLoading={transcriptLoading}
                isActiveAudio={isActiveAudio}
                onTimeClick={handleTimeClick}
                onEditSegment={handleEditTranscript}
                transcriptError={transcriptError}
                transcriptInProgress={transcriptInProgress}
                onRetry={handleTranscriptRetry}
              />
            </div>

            {/* Right Column: Summary Panel */}
            <SummaryTabPanel
              tabs={summaryTabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              scrollRef={summaryScrollRef}
              llmModels={llmModels}
              summaryModelUsed={summaryModelUsed}
              summaryModelSelection={summaryModelSelection}
              onModelSelectionChange={(type, value) =>
                setSummaryModelSelection((prev) => ({ ...prev, [type]: value }))
              }
              summaryStreaming={summaryStreaming}
              summaryStreamContent={summaryStreamContent}
              summaryOverviewMarkdown={summaryOverviewMarkdown}
              keyPointsMarkdown={keyPointsMarkdown}
              actionItemsMarkdown={actionItemsMarkdown}
              keyPoints={keyPoints}
              actionItems={actionItems}
              detectedStyleName={detectedStyleName}
              transcriptStageReached={transcriptStageReached}
              summaryError={summaryError}
              imageModelUsed={imageModelUsed}
              streamingImages={streamingImages}
              mediaToken={mediaToken}
              compareMode={compareMode}
              compareSummaryType={compareSummaryType}
              renderCompareView={renderCompareView}
              renderModelProvenance={renderModelProvenance}
              onRegenerate={regenerateSummary}
              onOpenCompare={openCompareDialog}
              onTimeClick={handleTimeClick}
              onToggleActionItem={toggleActionItem}
              getSummaryEmptyText={getSummaryEmptyText}
              t={t}
              compareDialog={
                <CompareModelDialog
                  open={compareDialogOpen}
                  onOpenChange={setCompareDialogOpen}
                  modelGroups={modelGroups}
                  selectedModels={compareSelectedModels}
                  onToggleModel={toggleCompareModel}
                  compareError={compareError}
                  compareLoading={compareLoading}
                  onStart={() => {
                    setCompareDialogOpen(false);
                    startCompare();
                  }}
                  t={t}
                />
              }
            />
          </div>
      <DeleteTaskDialog
        open={deleteOpen}
        isDeleting={isDeleting}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteTask}
        title={task.title}
      />
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
