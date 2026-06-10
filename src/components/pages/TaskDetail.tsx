"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuthStore } from '@/store/auth-store';
import { notifyError, notifySuccess } from '@/lib/notify';
import { ArrowLeft, FileText, Lightbulb } from 'lucide-react';
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
import TabSwitch from '@/components/task/TabSwitch';
import { PlayerBarContainer } from '@/components/task/PlayerBarContainer';
import { TranscriptList } from '@/components/task/TranscriptList';
import type { DisplayTranscriptSegment } from '@/lib/transcript-mapping';
import { type ActionItem, parseActionItems, parseSummaryLines } from '@/lib/summary-parse';
import { ActionItemToggle } from '@/components/task/ActionItemToggle';
import { ExportMenu } from '@/components/task/ExportMenu';
import { TaskVisibilityToggle } from '@/components/task/TaskVisibilityToggle';
import { resolveSummaryStreamBaseUrl, attachSseServerErrorListener, createSummaryStreamErrorHandler } from '@/lib/summary-stream';
import { createStreamThrottle } from '@/lib/stream-throttle';
import ProcessingState from '@/components/common/ProcessingState';
import ErrorState from '@/components/common/ErrorState';
import LoginModal from '@/components/auth/LoginModal';
import RetryCleanupToast from '@/components/task/RetryCleanupToast';
import { SummaryModelSelect } from '@/components/task/SummaryModelSelect';
import { useAPIClient } from '@/lib/use-api-client';
import { useGlobalStore } from '@/store/global-store';
import { setEnsureCurrentMedia, useAudioStore } from '@/store/audio-store';
import { resolveStreamToken } from '@/lib/stream-ticket';
import { useMediaToken } from '@/lib/media-url';
import { ApiError } from '@/types/api';
import { formatDuration } from '@/lib/utils';
import type {
  TaskDetail as ApiTaskDetail,
  TranscriptSegment as ApiTranscriptSegment,
  ComparisonResult,
  SummaryItem,
  SummaryRegenerateType,
  LLMModel,
  StreamingImage,
  SSEImageReadyEvent,
  SummaryStyleItem,
  TaskStatus,
} from '@/types/api';
import {
  extractPlaceholderDescription,
  findImagePlaceholders,
} from '@/lib/image-placeholder';
import {
  buildStreamingImagesFromSummary,
  buildStreamingImagesFromSummaryOrSeed,
  applyImageReadyToMap,
  mergeStreamingImages,
  hasUnresolvedImages,
  markUnresolvedImagesFailed,
  streamingImagesEqual,
} from '@/lib/summary-images';
import { useI18n } from '@/lib/i18n-context';
import { useDateFormatter } from '@/lib/use-date-formatter';
import { mapApiTranscript as mapApiTranscriptUtil } from '@/lib/transcript-mapping';

// 摘要 SSE 流 / 轮询的时间参数（毫秒）。原先散落为魔数，抽成命名常量便于核对与统一。
const SUMMARY_POLL_INTERVAL_MS = 2000; // 轮询 getSummary 检测版本号变化的间隔
const SUMMARY_STREAM_FLUSH_MS = 100; // SSE delta 帧合并窗口:每窗口最多写一次 state(整页重渲染+全文重 parse 的频率上限)
const SUMMARY_CONNECTION_TIMEOUT_MS = 3000; // 等 SSE connected 事件，超时则回退轮询
const SUMMARY_IMAGE_TIMEOUT_MS = 90000; // summary 完成后等 images.completed 的上限（60s/张 + 30s 缓冲）
const SUMMARY_IMAGE_RECONCILE_INTERVAL_MS = 4000; // completed 后图集对账重拉间隔（补 WS image_ready 漏收）
const SUMMARY_OVERALL_TIMEOUT_MS = 120000; // 整个摘要 / 对比流程的兜底总超时

// MarkdownContent 内含 react-markdown + remark-gfm + rehype-sanitize(约百 KB 级)。
// 摘要/要点/行动项内容均由异步 API 闸门(首屏渲染时为空、走空状态文案),故这里改 next/dynamic
// 把这组依赖移出 /tasks/[id] 首屏 JS;懒 chunk 在 API 拉取延迟期并行下载,内容就绪时通常已加载,
// 无可见闪烁。ssr:false:内容仅在浏览器异步获取后才有,无需服务端渲染。
const MarkdownContent = dynamic(
  () => import('@/components/task/MarkdownContent').then((m) => m.MarkdownContent),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-16">
        <div
          className="size-4 border-2 rounded-full animate-spin"
          style={{ borderColor: 'var(--app-primary) transparent var(--app-primary) var(--app-primary)' }}
        />
      </div>
    ),
  }
);

interface TaskDetailProps {
  onToggleTheme?: () => void;
}

interface KeyPoint {
  text: string;
  timeReference: string;
}

interface Speaker {
  name: string;
  color: string;
}

export default function TaskDetail({
  onToggleTheme = () => {}
}: TaskDetailProps) {
  const router = useRouter();
  const params = useParams();
  const authUser = useAuthStore((s) => s.user);
  const sessionStatus = useAuthStore((s) => s.status);
  const client = useAPIClient();
  const { t, locale } = useI18n();
  const { formatRelativeTime } = useDateFormatter();
  const id = params?.id as string;
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const audioDuration = useAudioStore((state) => state.duration);
  const currentSrc = useAudioStore((state) => state.src);
  const setSource = useAudioStore((state) => state.setSource);
  const togglePlayback = useAudioStore((state) => state.toggle);
  const play = useAudioStore((state) => state.play);
  const seek = useAudioStore((state) => state.seek);
  // 文章内联图 / 生成图走鉴权代理；<img> 不能带 Authorization 头，故附加 ?token=
  const mediaToken = useMediaToken();
  const [activeTab, setActiveTab] = useState('summary');
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
  // SSE 流式 delta 帧合并节流器:useState 惰性初始化成单例(整个生命周期同一张定时器表,
  // 卸载清理 effect 可统一 cancelAll,故须在该 effect 之前声明)。flush 实现依赖下方才定义的
  // updateSummaryFromStream,经 ref 转发——定时器到点时总是调到最新闭包;真正的 flush 语义
  // 与动机见 flushSummaryStream 定义处。
  const flushSummaryStreamRef = useRef<(summaryType: SummaryRegenerateType) => void>(() => {});
  const [summaryStreamThrottle] = useState(() =>
    createStreamThrottle<SummaryRegenerateType>(
      (summaryType) => flushSummaryStreamRef.current(summaryType),
      SUMMARY_STREAM_FLUSH_MS
    )
  );
  // State for streaming images in summary (for overview only)
  const [streamingImages, setStreamingImages] = useState<Map<string, StreamingImage>>(new Map());
  const imagesTimeoutRef = useRef<number | null>(null);
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
            setLoginOpen(true);
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

  // audio_url 与转写同理：audio_url 仅由 loadTask（mount/completed 触发）经 setTask 写入，
  // 而 WS 推送只带 status/progress，不带 audio_url。YouTube 任务 mount 时（仍在下载、
  // source_key 未生成）audio_url 为 null，整个 polishing/summarizing 阶段都不会刷新，
  // 导致点播放因 handlePlayPause 的 !audio_url 早返回而毫无反应，要到 completed 重拉才能播。
  // 进入「转写可见阶段」时音频必已落库，这里补拉一次 task 把 audio_url 就位，无需等 completed。
  useEffect(() => {
    if (!id || !transcriptStageReached) return;
    if (task?.audio_url) return; // 已就位则不补拉
    let cancelled = false;
    void (async () => {
      const refreshed = await client.getTask(id).catch(() => null);
      if (cancelled || !refreshed?.audio_url) return;
      const audioUrl = refreshed.audio_url;
      // 仅补 audio_url，不整体覆盖（status 由上面的 sync effect 维持为 WS 最新值）。
      setTask((prev) => (prev && !prev.audio_url ? { ...prev, audio_url: audioUrl } : prev));
    })();
    return () => {
      cancelled = true;
    };
  }, [id, transcriptStageReached, task?.audio_url, client]);

  useEffect(() => {
    const summaryStreams = summaryStreamRef.current;
    const summaryPolls = summaryPollRef.current;
    const comparePoll = comparePollRef.current;
    const compareStream = compareStreamRef.current;
    const imagesTimeout = imagesTimeoutRef.current;
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
      if (imagesTimeout) {
        window.clearTimeout(imagesTimeout);
      }
      // SSE delta 节流器的在途 flush 定时器一并丢弃(卸载后不得再 setState)。
      summaryStreamThrottle.cancelAll();
    };
  }, [summaryStreamThrottle]);

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
        setActionItems(parseActionItems(content, actionItemLabels));
      }
    },
    [actionItemLabels]
  );

  // Scroll summary container to bottom (used during streaming)
  const scrollSummaryToBottom = useCallback(() => {
    const container = summaryScrollRef.current;
    if (!container || !summaryAutoScrollRef.current) return;

    requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    });
  }, []);

  // SSE 流式 delta 帧合并节流:每个 delta 都直接 setState 会让 2400+ 行的本组件整页重渲染、
  // 右栏 MarkdownContent 对增长全文整篇重 parse(流式期间的主要成本)、左栏长转写整列 reconcile。
  // 改为 delta 只追加 summaryBufferRef 并 schedule;每 SUMMARY_STREAM_FLUSH_MS 才把 buffer
  // 全量 flush 进 state 一次(渲染次数砍 5-10x)。buffer 是唯一事实源、flush 取全量,绝不丢字;
  // 流结束/出错时 flushNow 立即清余量。SSE 协议与轮询兜底不动。
  const flushSummaryStream = useCallback((summaryType: SummaryRegenerateType) => {
    const content = summaryBufferRef.current[summaryType];
    updateSummaryFromStream(summaryType, content);
    // Auto-scroll to follow new content
    scrollSummaryToBottom();
    // 占位符探测随 flush 搭车(原先每个 delta 都全文扫一遍;overview 才有配图)。
    if (summaryType === 'overview') {
      const placeholders = findImagePlaceholders(content);
      setStreamingImages((prev) => {
        const next = new Map(prev);
        let changed = false;
        for (const placeholder of placeholders) {
          if (!next.has(placeholder)) {
            next.set(placeholder, {
              placeholder,
              description: extractPlaceholderDescription(placeholder),
              url: null,
              status: 'pending',
            });
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  }, [scrollSummaryToBottom, updateSummaryFromStream]);

  // 同步最新 flush 闭包进 ref(节流器声明在前、本闭包依赖的 updateSummaryFromStream 在后,
  // 见 summaryStreamThrottle 声明处)。effect 在首个定时器可能到点之前必已跑过:SSE 流只会
  // 在用户触发 regenerate 后才存在。
  useEffect(() => {
    flushSummaryStreamRef.current = flushSummaryStream;
  }, [flushSummaryStream]);

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
      // buffer 即将重置:丢弃上一轮流的在途 flush 定时器,避免旧定时器立刻 flush 空串。
      summaryStreamThrottle.cancel(summaryType);
      summaryBufferRef.current[summaryType] = '';

      // Reset streaming images state (only overview supports images)
      if (summaryType === 'overview') {
        setStreamingImages(new Map());
        // 重新生成 overview 即清掉上一次的右栏摘要错误，避免重试成功后旧错误仍遮住新内容。
        setSummaryError(null);
        if (imagesTimeoutRef.current) {
          window.clearTimeout(imagesTimeoutRef.current);
          imagesTimeoutRef.current = null;
        }
      }

      // Reset auto-scroll state and scroll to top to prepare for new content
      summaryAutoScrollRef.current = true;
      summaryScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

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
          }, SUMMARY_POLL_INTERVAL_MS);

          window.setTimeout(() => {
            if (summaryPollRef.current[summaryType]) {
              window.clearInterval(summaryPollRef.current[summaryType] ?? undefined);
              summaryPollRef.current[summaryType] = null;
              setSummaryStreaming((prev) => ({ ...prev, [summaryType]: false }));
              notifyError(t("task.retryFailed"));
            }
          }, SUMMARY_OVERALL_TIMEOUT_MS);
        };

        const normalizedBaseUrl = resolveSummaryStreamBaseUrl();

        // SSE 用短期 stream 票据（绑定 task_id+summary_type）拼进 ?token=；签票失败返回 null，
        // 不回退长效 access JWT，转走下方 else 的 HTTP regenerate + 轮询兜底。
        const token = await resolveStreamToken(client, id, summaryType);
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
          }, SUMMARY_CONNECTION_TIMEOUT_MS);

          // 流在 connected 之前出错时，connected / connectionTimeout 都来不及触发 regenerate。
          // 错误处理器先幂等补发 triggerRegenerate 再轮询，否则后端从未 regenerate，轮询空等。
          const handleStreamError = createSummaryStreamErrorHandler({
            cleanup: (message?: string) => {
              // 出错收尾:先把 buffer 余量立即 flush,已收到的部分内容保持可见,绝不丢字。
              summaryStreamThrottle.flushNow(summaryType);
              window.clearTimeout(connectionTimeout);
              eventSource.close();
              summaryStreamRef.current[summaryType] = null;
              setSummaryStreaming((prev) => ({ ...prev, [summaryType]: false }));
              notifyError(message || t("task.retryFailed"));
            },
            triggerRegenerate,
            startPolling,
          });

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
              summaryStreamThrottle.cancel(summaryType);
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
              // 帧合并:delta 只追加 buffer 并 schedule,每 ~100ms 才一次性 flush 进 state
              //(state 写入/自动滚动/占位符探测都在 flushSummaryStream 里搭车执行)。
              summaryBufferRef.current[summaryType] += payload.content;
              summaryStreamThrottle.schedule(summaryType);
            } catch {
              // Ignore malformed payloads
            }
          });

          // Handle images.processing event (overview only)
          eventSource.addEventListener("images.processing", (event) => {
            try {
              const payload = JSON.parse(event.data);
              if (summaryType !== 'overview') return;
              // Update all pending placeholders to generating status
              if (payload.status === 'generating' && payload.total > 0) {
                setStreamingImages((prev) => {
                  const next = new Map(prev);
                  for (const [key, img] of next) {
                    if (img.status === 'pending') {
                      next.set(key, { ...img, status: 'generating' });
                    }
                  }
                  return next;
                });
              }
            } catch {
              // Ignore malformed payloads
            }
          });

          // Handle image.ready event (singular - one image at a time, overview only)
          eventSource.addEventListener("image.ready", (event) => {
            try {
              const payload: SSEImageReadyEvent = JSON.parse(event.data);
              if (summaryType !== 'overview') return;
              // Update this single image's state
              setStreamingImages((prev) => {
                const next = new Map(prev);
                next.set(payload.placeholder, {
                  placeholder: payload.placeholder,
                  description: extractPlaceholderDescription(payload.placeholder),
                  url: payload.status === 'success' ? payload.url : null,
                  status: payload.status === 'success' ? 'ready' : 'failed',
                });
                return next;
              });
              // Auto-scroll when image loads (content height may change)
              scrollSummaryToBottom();
              // Optional: could show progress like "2/3" using payload.current / payload.total
            } catch {
              // Ignore malformed payloads
            }
          });

          // Handle images.completed event (all images done, overview only)
          eventSource.addEventListener("images.completed", () => {
            if (summaryType !== 'overview') return;
            // Clear images timeout and close connection
            if (imagesTimeoutRef.current) {
              window.clearTimeout(imagesTimeoutRef.current);
              imagesTimeoutRef.current = null;
            }
            eventSource.close();
            summaryStreamRef.current[summaryType] = null;
            client.getSummary(id).then((result) => {
              buildSummaryState(result.items);
            });
          });

          eventSource.addEventListener("summary.completed", (event) => {
            // 流结束:立即 flush buffer 余量(全文),绝不丢字——等下方 getSummary 整版
            // 经隧道回来之前,已收到的完整内容先显示完。
            summaryStreamThrottle.flushNow(summaryType);
            let hasImages = false;
            try {
              const payload = JSON.parse(event.data);
              if (payload.summary_type && payload.summary_type !== summaryType) return;
              hasImages = Boolean(payload.has_images);
            } catch {
              // Ignore malformed payloads
            }

            // If no images expected, close connection immediately
            if (!hasImages) {
              eventSource.close();
              summaryStreamRef.current[summaryType] = null;
              setSummaryStreaming((prev) => ({ ...prev, [summaryType]: false }));
            } else {
              // Keep connection open for image.ready and images.completed events
              // Set a timeout to close if images.completed never arrives (90s = 60s per image + 30s buffer)
              imagesTimeoutRef.current = window.setTimeout(() => {
                eventSource.close();
                summaryStreamRef.current[summaryType] = null;
                setSummaryStreaming((prev) => ({ ...prev, [summaryType]: false }));
                // Mark remaining generating images as failed
                setStreamingImages((prev) => {
                  const next = new Map(prev);
                  for (const [key, img] of next) {
                    if (img.status === 'pending' || img.status === 'generating') {
                      next.set(key, { ...img, status: 'failed' });
                    }
                  }
                  return next;
                });
              }, SUMMARY_IMAGE_TIMEOUT_MS);
              // Mark text streaming as complete, but images may still be loading
              setSummaryStreaming((prev) => ({ ...prev, [summaryType]: false }));
            }

            client.getSummary(id).then((result) => {
              buildSummaryState(result.items);
            });
          });

          attachSseServerErrorListener(eventSource, handleStreamError);

          eventSource.onerror = () => {
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
    [buildSummaryState, client, id, llmModels, scrollSummaryToBottom, summaryModelSelection, summaryStreaming, summaryStreamThrottle, summaryVersions, t, updateSummaryFromStream]
  );

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

  // 渐进式展示：订阅全局 store 里本任务的 image_ready 事件队列，逐条 patch 进 streamingImages，
  // 再清空已消费的事件（事件量极小，图 max 3 张）。
  const imageReadyQueue = useGlobalStore((state) => state.imageReadyEvents[id || '']);
  const clearImageReadyEvents = useGlobalStore((state) => state.clearImageReadyEvents);

  useEffect(() => {
    if (!id) return;
    if (!imageReadyQueue || imageReadyQueue.length === 0) return;
    setStreamingImages((prev) => {
      let next = prev;
      for (const evt of imageReadyQueue) {
        next = applyImageReadyToMap(next, evt);
      }
      return next;
    });
    clearImageReadyEvents(id);
  }, [id, imageReadyQueue, clearImageReadyEvents]);

  // 渐进式展示·全局-WS 路径的 pending 超时兜底：页面加载后图片靠上面的全局 WS image_ready 逐张补；
  // 若 worker 崩溃 / 图数超过后端 max_images，某些占位符将永远收不到 image_ready 而无限转圈——
  // 这违背本功能「用户不用一直等」的初衷。故只要还有 pending/generating 图就武装一个超时；任意一张图
  // 落地（图集变化=有进展）都会重置该窗口（即「连续 SUMMARY_IMAGE_TIMEOUT_MS 无进展」才判失败），
  // 到点把仍未就绪的占位符标为 failed。与 SSE/重新生成路径同一常量、同一失败语义，行为一致。
  useEffect(() => {
    // 无未就绪图：不武装；上一把（若有）已由上一次 effect 的 cleanup 清掉。
    if (!hasUnresolvedImages(streamingImages)) return;
    // 用闭包持有句柄并在 cleanup 里清——React 在每次重跑前及卸载时都会执行 cleanup，
    // 故「图集变化重置窗口」与「卸载清定时器」都自洽（避免挂载时快照 ref 造成的清理失效）。
    const handle = window.setTimeout(() => {
      setStreamingImages((prev) => markUnresolvedImagesFailed(prev));
    }, SUMMARY_IMAGE_TIMEOUT_MS);
    return () => window.clearTimeout(handle);
  }, [streamingImages]);

  // 渐进式展示·配图对账兜底：配图是任务 completed【之后】才异步逐张生成的（见后端 YouTube 管线），
  // 而把占位符换成真图的唯一实时机制是一次性 WS image_ready（Redis pub/sub，无持久化/无重放）。
  // 该窗口内若 WS 漏收（慢隧道断线重连 / 页面切后台 / 事件早于客户端重订阅），事件永久丢失，
  // 占位符停在 pending 直到上面的 90s 兜底翻成 failed——但此时 DB 里 summary.images 其实早已 ready。
  // 故 completed 且仍有未就绪图时，定时重拉 getSummary 与 DB 对账：mergeStreamingImages 幂等
  // （本地已到终态胜过陈旧 DB pending，DB 终态始终采用），全部就绪或被 90s 兜底判失败后 hasUnresolvedImages
  // 转 false 即自动停。仅读写 streamingImages，与转写状态(三态/生成中/提早整块)完全正交，不互相影响。
  useEffect(() => {
    if (!id) return;
    if (task?.status !== 'completed') return;
    if (!hasUnresolvedImages(streamingImages)) return;
    let cancelled = false;
    const handle = window.setInterval(() => {
      void (async () => {
        const result = await client.getSummary(id).catch(() => null);
        if (cancelled || !result) return;
        const dbImages = buildStreamingImagesFromSummary(result.items);
        // DB 暂无图集（异常/版本切换竞态）：不要用空集合覆盖已显示的占位符（反复轮询会放大此风险）。
        if (dbImages.size === 0) return;
        // 内容无变化时保留原引用：避免 mergeStreamingImages 的新 Map 引用被 90s 兜底误判为「有进展」
        // 而无限重置其窗口（那样真卡住的图永远不会被判失败）。仅 DB 真有进展才更新+重置兜底窗口。
        setStreamingImages((prev) => {
          const merged = mergeStreamingImages(prev, dbImages);
          return streamingImagesEqual(prev, merged) ? prev : merged;
        });
      })();
    }, SUMMARY_IMAGE_RECONCILE_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [id, task?.status, streamingImages, client]);

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

  const handleEditTranscript = useCallback((segmentId: string, newContent: string) => {
    setTranscript(prev =>
      prev.map(segment =>
        segment.id === segmentId ? { ...segment, content: newContent } : segment
      )
    );
  }, []);

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
        comparePollRef.current = window.setInterval(poll, SUMMARY_POLL_INTERVAL_MS);
        window.setTimeout(() => {
          if (comparePollRef.current) {
            window.clearInterval(comparePollRef.current);
            comparePollRef.current = null;
            setCompareLoading(false);
            setCompareError(t("task.compareTimeout"));
          }
        }, SUMMARY_OVERALL_TIMEOUT_MS);
      };

      const normalizedBaseUrl = resolveSummaryStreamBaseUrl();
      // 对比 SSE 同样用 stream 票据拼进 ?token=；签票失败返回 null（不回退长 JWT），
      // 转走下方 else 的 startPollingFallback。
      const token = await resolveStreamToken(client, id, compareSummaryType);

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

        attachSseServerErrorListener(eventSource, handleStreamError);

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
  const modelGroups = useMemo(() => {
    const groups = new Map<string, LLMModel[]>();
    llmModels.forEach((model) => {
      const key = model.provider_display || model.display_name || model.provider;
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

  if (!authUser) {
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
          isAuthenticated={!!authUser}
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
          isAuthenticated={!!authUser}
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
          isAuthenticated={!!authUser}
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
          isAuthenticated={!!authUser}
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

  const detectedStyleName =
    task?.detected_summary_style
      ? (summaryStyles.find((s) => s.id === task.detected_summary_style)?.name ?? null)
      : null;

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--app-bg)' }}>
      {/* Header */}
      <Header 
        isAuthenticated={!!authUser}
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

              {/* Right: Export */}
              <ExportMenu
                label={t("task.export")}
                items={[
                  { key: "pdf", label: t("task.exportPdf") },
                  { key: "word", label: t("task.exportWord") },
                  { key: "markdown", label: t("task.exportMarkdown") },
                ]}
              />
            </div>
          </div>

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
              {/* Column Header */}
              <div className="flex items-center gap-2 px-4 py-4 border-b" style={{ borderColor: 'var(--app-glass-border)' }}>
                <FileText className="w-5 h-5" style={{ color: 'var(--app-text)' }} />
                <h2 className="text-base" style={{ fontWeight: 600, color: 'var(--app-text)' }}>
                  {t("task.transcriptTitle")}
                </h2>
              </div>

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
              <div
                ref={summaryScrollRef}
                role="tabpanel"
                id={`tabpanel-${activeTab}`}
                aria-labelledby={`tab-${activeTab}`}
                tabIndex={0}
                className="flex-1 overflow-y-auto p-6"
              >
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
                          {detectedStyleName && (
                            <p className="text-xs mt-1" style={{ color: 'var(--app-text-subtle)' }}>
                              {t("task.detectedStyle", { style: detectedStyleName })}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <SummaryModelSelect
                            models={llmModels}
                            value={summaryModelSelection.overview ?? null}
                            onChange={(value) =>
                              setSummaryModelSelection((prev) => ({
                                ...prev,
                                overview: value,
                              }))
                            }
                            disabled={summaryStreaming.overview || llmModels.length === 0}
                            className="text-xs"
                          />
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
                      {transcriptStageReached && !summaryOverviewMarkdown && !summaryStreaming.overview ? (
                        <p className="text-base leading-7" style={{ color: 'var(--app-text-subtle)' }}>
                          {t("task.summaryGenerating")}
                        </p>
                      ) : summaryError && !summaryOverviewMarkdown ? (
                        // 仅在「尚无已落地的摘要正文」时展示右栏错误。已成功展示过 overview 后，
                        // 一次瞬时重载错误（如 completed 重载时 getSummary 抖动）不应把已展示内容连带抹掉，
                        // 与转写「失败不连带已展示内容」同一语义。
                        <p className="text-base leading-7" style={{ color: 'var(--app-danger)' }}>
                          {summaryError}
                        </p>
                      ) : summaryStreaming.overview && summaryStreamContent.overview ? (
                        <MarkdownContent content={summaryStreamContent.overview} imageModel={imageModelUsed} streamingImages={streamingImages} mediaToken={mediaToken} />
                      ) : compareMode && compareSummaryType === "overview" ? (
                        renderCompareView()
                      ) : summaryOverviewMarkdown ? (
                        <MarkdownContent content={summaryOverviewMarkdown} imageModel={imageModelUsed} streamingImages={streamingImages} mediaToken={mediaToken} />
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
                        <SummaryModelSelect
                          models={llmModels}
                          value={summaryModelSelection.key_points ?? null}
                          onChange={(value) =>
                            setSummaryModelSelection((prev) => ({
                              ...prev,
                              key_points: value,
                            }))
                          }
                          disabled={summaryStreaming.key_points || llmModels.length === 0}
                          className="text-xs"
                        />
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
                      <MarkdownContent content={summaryStreamContent.key_points} streamingImages={streamingImages} mediaToken={mediaToken} />
                    ) : compareMode && compareSummaryType === "key_points" ? (
                      renderCompareView()
                    ) : keyPointsMarkdown ? (
                      // V1.2 format: Render full Markdown content
                      <MarkdownContent content={keyPointsMarkdown} streamingImages={streamingImages} mediaToken={mediaToken} />
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
                        <SummaryModelSelect
                          models={llmModels}
                          value={summaryModelSelection.action_items ?? null}
                          onChange={(value) =>
                            setSummaryModelSelection((prev) => ({
                              ...prev,
                              action_items: value,
                            }))
                          }
                          disabled={summaryStreaming.action_items || llmModels.length === 0}
                          className="text-xs"
                        />
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
                      <MarkdownContent content={summaryStreamContent.action_items} streamingImages={streamingImages} mediaToken={mediaToken} />
                    ) : compareMode && compareSummaryType === "action_items" ? (
                      renderCompareView()
                    ) : actionItemsMarkdown ? (
                      // V1.2 format: Render full Markdown content
                      <MarkdownContent content={actionItemsMarkdown} streamingImages={streamingImages} mediaToken={mediaToken} />
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
                          <ActionItemToggle
                            completed={item.completed}
                            label={item.task}
                            onToggle={() => toggleActionItem(item.id)}
                          />
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

              </div>

              {/* 对比弹窗：改用 Radix Dialog（焦点陷阱 / Esc / 焦点恢复 / role=dialog）。
                  原本就用 glass-panel-strong + max-w-lg，与 DialogContent 默认基本一致，仅覆盖 grid→block 与圆角。 */}
              <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen}>
                <DialogContent className="block w-full max-w-lg sm:max-w-lg rounded-2xl space-y-4">
                  <DialogTitle className="text-lg" style={{ fontWeight: 600, color: 'var(--app-text)' }}>
                    {t("task.compareTitle")}
                  </DialogTitle>
                  <DialogDescription className="text-sm" style={{ color: 'var(--app-text-subtle)' }}>
                    {t("task.compareHint")}
                  </DialogDescription>

                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                      {modelGroups.map((group) => (
                        <div key={group.label} className="space-y-2">
                          <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--app-text-muted)' }}>
                            {group.label}
                          </div>
                          <div className="space-y-2">
                            {group.models.map((model) => {
                              const value = model.model_id || model.provider;
                              const isChecked = compareSelectedModels.includes(value);
                              const parts: string[] = [model.display_name || model.model_id || model.provider];
                              if (model.cost_tier) {
                                parts.push(t(`task.summaryModelCost${model.cost_tier.charAt(0).toUpperCase() + model.cost_tier.slice(1)}` as const));
                              }
                              if (!model.is_available) {
                                parts.push(t("task.summaryModelUnavailable"));
                              } else if (model.is_recommended) {
                                parts.push(t("task.summaryModelRecommended"));
                              }
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
                                  <span>{parts.join(" · ")}</span>
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
                </DialogContent>
              </Dialog>
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
