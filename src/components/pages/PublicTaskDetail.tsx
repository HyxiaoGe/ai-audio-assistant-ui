"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ArrowLeft, FileText, Globe } from 'lucide-react';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import EmptyState from '@/components/common/EmptyState';
import TabSwitch from '@/components/task/TabSwitch';
import { PlayerBarContainer } from '@/components/task/PlayerBarContainer';
import { TranscriptList } from '@/components/task/TranscriptList';
import { useAPIClient } from '@/lib/use-api-client';
import { useI18n } from '@/lib/i18n-context';
import { usePublicMediaToken } from '@/lib/media-url';
import { useAudioStore } from '@/store/audio-store';
import { extractPlaceholderDescription } from '@/lib/image-placeholder';
import { mapApiTranscript } from '@/lib/transcript-mapping';
import type { DisplayTranscriptSegment } from '@/lib/transcript-mapping';
import { ApiError } from '@/types/api';
import type {
  PublicSummaryItem,
  PublicSummaryResponse,
  PublicTaskDetail as PublicTaskDetailData,
  PublicTranscriptItem,
  StreamingImage,
  SummaryType,
  TranscriptSegment as ApiTranscriptSegment,
} from '@/types/api';

/**
 * 三处内联 spinner(dynamic 占位/整页/摘要栏)样式相同——抽成小函数组件 DRY。
 * size: 'sm'(size-4,摘要栏/dynamic 占位) | 'md'(size-5,整页居中)
 */
function InlineSpinner({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'size-5' : 'size-4';
  return (
    <div className="flex items-center justify-center py-16">
      <div
        className={`${cls} border-2 rounded-full animate-spin`}
        style={{ borderColor: 'var(--app-primary) transparent var(--app-primary) var(--app-primary)' }}
      />
    </div>
  );
}

// 与 TaskDetail 同款:react-markdown + remark-gfm + rehype-sanitize(约 47KB chunk)移出首屏 JS。
// 给 loading 占位避免「内容到位前白屏」;并在组件挂载时主动预热该 chunk(见下方 useEffect),
// 让它与 detail/transcript/summary 三请求并行下载,而非等三请求都回来才开始下,消灭可见闪烁。
const MarkdownContent = dynamic(
  () => import('@/components/task/MarkdownContent').then((m) => m.MarkdownContent),
  {
    ssr: false,
    loading: () => <InlineSpinner size="sm" />,
  },
);

const SECTION_ORDER: { type: SummaryType; titleKey: string; emptyKey: string }[] = [
  { type: 'overview', titleKey: 'explore.summaryTitle', emptyKey: 'task.summaryEmpty' },
  { type: 'key_points', titleKey: 'explore.keyPointsTitle', emptyKey: 'task.keyPointsEmpty' },
  { type: 'action_items', titleKey: 'explore.actionItemsTitle', emptyKey: 'task.actionItemsEmpty' },
];

type PublicTab = 'summary' | 'keypoints' | 'actions';

const TAB_TO_SECTION: Record<PublicTab, SummaryType> = {
  summary: 'overview',
  keypoints: 'key_points',
  actions: 'action_items',
};

/** 公开页是静态终态:非 ready 一律按 failed 展示回退文案,绝不挂无限 spinner。 */
function buildPublicStreamingImages(summary: PublicSummaryItem): Map<string, StreamingImage> {
  const map = new Map<string, StreamingImage>();
  for (const img of summary.images ?? []) {
    map.set(img.placeholder, {
      placeholder: img.placeholder,
      description: extractPlaceholderDescription(img.placeholder),
      url: img.url,
      status: img.status === 'ready' ? 'ready' : 'failed',
      // url 为 OSS 预签名直链(600s)时带上代理回落路径:直链过期(长开页面 403)
      // 由 ImagePlaceholder 切到 proxy_url 自愈;url 已是代理回落形态时后端给 null。
      fallbackUrl: img.proxy_url ?? null,
    });
  }
  return map;
}

interface PublicTaskDetailProps {
  isAuthenticated: boolean;
  onOpenLogin: () => void;
  onToggleTheme?: () => void;
  /**
   * 服务端 LAN 预取初值(可选):有初值的路对应 state 直接以 props 初始化,跳过该路的
   * 客户端初始拉取(loading 初值 false,无 spinner 阶段);没有的路照常客户端拉取。
   * 转写刻意不内嵌(1772 段进 RSC flight 会让 HTML 爆炸),恒走客户端,与 hydration 并行。
   * 局部重试(loadDetail/loadSummary)与初值无关,重试时照常走客户端拉取。
   */
  initialDetail?: PublicTaskDetailData;
  initialSummary?: PublicSummaryResponse;
}

export default function PublicTaskDetail({
  isAuthenticated,
  onOpenLogin,
  onToggleTheme,
  initialDetail,
  initialSummary,
}: PublicTaskDetailProps) {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const client = useAPIClient();
  const mediaToken = usePublicMediaToken(id);

  // detail 单独成态:它回来即可渲染整页骨架,不再被转写/摘要拖住(拆瀑布的核心)。
  // 有服务端预取初值时直接以初值落地,loading 从 false 起步(无整页 spinner 阶段)。
  const [task, setTask] = useState<PublicTaskDetailData | null>(initialDetail ?? null);
  const [detailLoading, setDetailLoading] = useState(!initialDetail);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // 转写:独立 loading / error,失败只显示左栏局部错误 + 局部重试,绝不连带整页。
  const [transcripts, setTranscripts] = useState<PublicTranscriptItem[]>([]);
  const [transcriptLoading, setTranscriptLoading] = useState(true);
  const [transcriptError, setTranscriptError] = useState(false);

  // 摘要:独立 loading / error,失败只显示右栏局部错误 + 局部重试。
  const [summaries, setSummaries] = useState<PublicSummaryItem[]>(initialSummary?.items ?? []);
  const [summaryLoading, setSummaryLoading] = useState(!initialSummary);
  const [summaryError, setSummaryError] = useState(false);

  const [activeTab, setActiveTab] = useState<PublicTab>('summary');

  // 代际计数 ref:每个 loader 独立一个 ref,防止旧响应(局部重试连点 / id 切换)覆盖新结果。
  // 调用开头记录当前代,所有 setState 前先校验代际是否仍是最新,过期则丢弃。
  const detailGenRef = useRef(0);
  const transcriptGenRef = useRef(0);
  const summaryGenRef = useRef(0);

  // 挂载即预热 MarkdownContent chunk:与三请求并行下载,内容就绪时通常已加载完,无白屏。
  useEffect(() => {
    void import('@/components/task/MarkdownContent');
  }, []);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    const gen = ++detailGenRef.current;
    setDetailLoading(true);
    setNotFound(false);
    setLoadError(false);
    try {
      const detail = await client.getPublicTask(id);
      if (gen !== detailGenRef.current) return;
      setTask(detail);
    } catch (err) {
      if (gen !== detailGenRef.current) return;
      // 40401 = 不存在/未公开/已收回 → 终态 notFound;其余(网络/5xx)→ 整页可重试。
      if (err instanceof ApiError && err.code === 40401) setNotFound(true);
      else setLoadError(true);
    } finally {
      if (gen === detailGenRef.current) setDetailLoading(false);
    }
  }, [client, id]);

  const loadTranscript = useCallback(async () => {
    if (!id) return;
    const gen = ++transcriptGenRef.current;
    setTranscriptLoading(true);
    setTranscriptError(false);
    try {
      const transcript = await client.getPublicTranscript(id);
      if (gen !== transcriptGenRef.current) return;
      setTranscripts(transcript.items);
    } catch {
      if (gen !== transcriptGenRef.current) return;
      // 转写瞬态失败:只标左栏错误,可局部重试;不影响整页与右栏。
      setTranscriptError(true);
    } finally {
      if (gen === transcriptGenRef.current) setTranscriptLoading(false);
    }
  }, [client, id]);

  const loadSummary = useCallback(async () => {
    if (!id) return;
    const gen = ++summaryGenRef.current;
    setSummaryLoading(true);
    setSummaryError(false);
    try {
      const summary = await client.getPublicSummary(id);
      if (gen !== summaryGenRef.current) return;
      setSummaries(summary.items);
    } catch {
      if (gen !== summaryGenRef.current) return;
      // 摘要瞬态失败:只标右栏错误,可局部重试;不影响整页与左栏。
      setSummaryError(true);
    } finally {
      if (gen === summaryGenRef.current) setSummaryLoading(false);
    }
  }, [client, id]);

  // 三请求仍同时发出(并行,不串行),但各自独立落态:detail 回来即渲骨架,转写/摘要各自栏内 loading/error。
  // 有服务端预取初值的路(detail/summary)跳过初始客户端拉取——初值即数据,重复拉只是浪费一次
  // 隧道往返;转写恒走客户端(刻意不内嵌,见 props 注释)。错误后的局部重试直接调 loadXxx,不经此处。
  useEffect(() => {
    if (!initialDetail) void loadDetail();
    void loadTranscript();
    if (!initialSummary) void loadSummary();
  }, [loadDetail, loadTranscript, loadSummary, initialDetail, initialSummary]);

  // ===== 音频播放(与 TaskDetail 同款 audio-store 集成;媒体票走公开通道) =====
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const audioDuration = useAudioStore((s) => s.duration);
  const currentSrc = useAudioStore((s) => s.src);
  const setSource = useAudioStore((s) => s.setSource);
  const togglePlayback = useAudioStore((s) => s.toggle);
  const play = useAudioStore((s) => s.play);
  const seek = useAudioStore((s) => s.seek);

  // 播放源:优先 OSS 预签名直链(完整 https URL,绕开隧道;appendMediaToken 对其 no-op,不拼媒体票),
  // 无直链回落代理路径。直链经 setSource 第 4 参把 audio_url 登记为回落源:直链播放失败(如预签名
  // 过期 403)时 audio-store 的 reloadWithFreshToken 一次性切到代理路径,走既有媒体票/换票重载链。
  const playbackSrc = task?.audio_direct_url || task?.audio_url || null;
  const playbackFallback = task?.audio_direct_url ? (task?.audio_url ?? null) : null;
  // 直链失败回落后 currentSrc 变为 audio_url 代理路径:仍视作本任务激活(进度/播放态照常显示),
  // 且后续点击只 toggle、绝不切回已坏的直链。
  const isActiveAudio = Boolean(
    currentSrc && (currentSrc === playbackSrc || (task?.audio_url != null && currentSrc === task.audio_url)),
  );

  const handlePlayPause = useCallback(() => {
    if (!playbackSrc || !task) return;
    if (!isActiveAudio) {
      setSource(playbackSrc, task.id, task.title ?? '', playbackFallback);
      play();
      return;
    }
    togglePlayback();
  }, [playbackSrc, playbackFallback, isActiveAudio, task, setSource, play, togglePlayback]);

  const handleSeek = useCallback((time: number) => {
    if (playbackSrc && task && !isActiveAudio) {
      setSource(playbackSrc, task.id, task.title ?? '', playbackFallback);
    }
    seek(time);
  }, [playbackSrc, playbackFallback, isActiveAudio, task, setSource, seek]);

  // TranscriptList 的 onTimeClick 接收 "MM:SS" 字符串(与私有页同款),转成秒后 seek。
  const handleTimeClick = useCallback((time: string) => {
    const [mins, secs] = time.split(':').map(Number);
    if (Number.isNaN(mins) || Number.isNaN(secs)) return;
    handleSeek(mins * 60 + secs);
  }, [handleSeek]);

  const duration = isActiveAudio
    ? (audioDuration || task?.duration_seconds || 0)
    : (task?.duration_seconds || 0);
  const displayIsPlaying = isActiveAudio ? isPlaying : false;

  // 说话人调色板:与私有页(TaskDetail availableSpeakers)同款,经 i18n。
  const availableSpeakers = useMemo(
    () => [
      { name: t('transcript.speakerA'), color: 'var(--app-primary)' },
      { name: t('transcript.speakerB'), color: 'var(--app-success)' },
      { name: t('transcript.speakerC'), color: 'var(--app-warning)' },
      { name: t('transcript.speakerD'), color: 'var(--app-danger)' },
      { name: t('transcript.speakerE'), color: 'var(--app-purple)' },
      { name: t('transcript.unknownSpeaker'), color: 'var(--app-text-subtle)' },
    ],
    [t],
  );

  // 公开转写项 → 共享 DisplayTranscriptSegment 映射:sequence 充当 id,words/原文/编辑标记置空。
  // 复用与私有页同一 mapApiTranscript,白得说话人头像配色 / 高亮 / 自动滚动 / 起止时间区间。
  const displayTranscript = useMemo<DisplayTranscriptSegment[]>(() => {
    const unknownSpeakerLabel = t('transcript.unknownSpeaker');
    const asApiSegments: ApiTranscriptSegment[] = transcripts.map((item) => ({
      id: String(item.sequence),
      sequence: item.sequence,
      speaker_id: item.speaker_id,
      speaker_label: item.speaker_label,
      content: item.content,
      start_time: item.start_time,
      end_time: item.end_time,
      confidence: null,
      words: null,
      is_edited: false,
      original_content: null,
      created_at: '',
      updated_at: '',
    }));
    return mapApiTranscript(asApiSegments, availableSpeakers, unknownSpeakerLabel);
  }, [transcripts, availableSpeakers, t]);

  const summaryTabs = useMemo(
    () => [
      { id: 'summary', label: t('task.tabs.summary') },
      { id: 'keypoints', label: t('task.tabs.keypoints') },
      { id: 'actions', label: t('task.tabs.actions') },
    ],
    [t],
  );

  const sectionByType = useMemo(() => {
    const map = new Map<SummaryType, { summary: PublicSummaryItem; images: Map<string, StreamingImage> }>();
    for (const summary of summaries) {
      map.set(summary.summary_type, { summary, images: buildPublicStreamingImages(summary) });
    }
    return map;
  }, [summaries]);

  const shell = (children: ReactNode) => (
    <div className="h-screen flex flex-col" style={{ background: 'var(--app-bg)' }}>
      <Header
        isAuthenticated={isAuthenticated}
        onOpenLogin={onOpenLogin}
        onToggleTheme={onToggleTheme}
      />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--app-bg)' }}>
          {children}
        </main>
      </div>
    </div>
  );

  // detail 尚未回来:整页 spinner(此时连标题/骨架都没有,只能等 detail)。
  if (detailLoading) {
    return shell(
      <div className="flex-1 flex items-center justify-center">
        <InlineSpinner size="md" />
      </div>,
    );
  }

  if (notFound) {
    return shell(
      <div className="flex-1 overflow-y-auto p-8">
        <EmptyState
          variant="default"
          title={t('explore.notFoundTitle')}
          description={t('explore.notFoundDescription')}
          action={{ label: t('explore.backToExplore'), onClick: () => router.push('/explore'), variant: 'primary' }}
        />
      </div>,
    );
  }

  if (loadError || !task) {
    return shell(
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 p-8">
        <p className="text-sm" style={{ color: 'var(--app-danger)' }}>{t('explore.loadFailed')}</p>
        <button
          onClick={() => void loadDetail()}
          className="px-4 py-2 text-sm border rounded-lg hover:bg-[var(--app-glass-bg-strong)] transition-colors"
          style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
        >
          {t('explore.retry')}
        </button>
      </div>,
    );
  }

  const activeSectionType = TAB_TO_SECTION[activeTab];

  return shell(
    <>
      {/* Title Bar:固定 64px,左「回到广场」/ 中标题 / 右「公开」徽标(对齐私有页骨架) */}
      <div
        className="flex items-center justify-between px-6 border-b"
        style={{ height: '64px', borderColor: 'var(--app-glass-border)' }}
      >
        <button
          onClick={() => router.push('/explore')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-[var(--app-glass-bg-strong)] transition-colors"
          style={{ color: 'var(--app-text-muted)' }}
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm" style={{ fontWeight: 500 }}>{t('explore.backToExplore')}</span>
        </button>
        <h1 className="text-xl truncate px-4" style={{ fontWeight: 600, color: 'var(--app-text)' }}>
          {task.title}
        </h1>
        <span
          className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-full flex-shrink-0"
          style={{ background: 'var(--app-glass-bg-strong)', color: 'var(--app-primary)' }}
        >
          <Globe className="w-3.5 h-3.5" />
          {t('task.visibilityPublic')}
        </span>
      </div>

      {/* 来源归属:有 youtube_info(封面卡已含视频信息)时不重复;无 youtube_info 但 source_url 在(提取回退)时保留 */}
      {task.source_type === 'youtube' && task.source_url && !task.youtube_info && (
        <div className="flex justify-center pt-3">
          <a
            href={task.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline hover:text-foreground"
            style={{ color: 'var(--app-text-muted)' }}
          >
            {t('explore.viewSource')}
          </a>
        </div>
      )}

      {/* 播放器区:有 youtube_info 渲 YouTube 封面卡(channel 可空已守卫);否则普通播放条 */}
      {(playbackSrc || task.youtube_info) && (
        <PlayerBarContainer
          isActiveAudio={isActiveAudio}
          duration={duration}
          isPlaying={displayIsPlaying}
          onPlayPause={handlePlayPause}
          onSeek={handleSeek}
          youtube={
            task.source_type === 'youtube' && task.youtube_info
              ? { youtubeInfo: task.youtube_info, sourceUrl: task.source_url ?? undefined }
              : null
          }
        />
      )}

      {/* 双栏:左右各自独立滚动(对齐私有页);保留公开页响应式断点(窄屏单栏,lg 双栏) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden border-t" style={{ borderColor: 'var(--app-glass-border)' }}>
        {/* 左栏:转写(只读富列表) */}
        <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r min-h-0" style={{ borderColor: 'var(--app-glass-border)' }}>
          <div className="flex items-center gap-2 px-4 py-4 border-b" style={{ borderColor: 'var(--app-glass-border)' }}>
            <FileText className="w-5 h-5" style={{ color: 'var(--app-text)' }} />
            <h2 className="text-base" style={{ fontWeight: 600, color: 'var(--app-text)' }}>
              {t('task.transcriptTitle')}
            </h2>
          </div>
          {/* 转写错误/加载统一交给 TranscriptList 内建 UI 处理,与私有页 TaskDetail 保持一致 */}
          <TranscriptList
            transcript={displayTranscript}
            transcriptLoading={transcriptLoading}
            transcriptError={transcriptError}
            isActiveAudio={isActiveAudio}
            onTimeClick={handleTimeClick}
            onEditSegment={() => {}}
            onRetry={() => void loadTranscript()}
            readOnly
          />
        </div>

        {/* 右栏:摘要 / 要点 / 行动项(TabSwitch 三页签 + MarkdownContent 配图管线) */}
        <div className="flex-1 flex flex-col min-h-0" style={{ maxWidth: '100%' }}>
          <div className="flex justify-center border-b" style={{ borderColor: 'var(--app-glass-border)' }}>
            <TabSwitch
              tabs={summaryTabs}
              activeTab={activeTab}
              onTabChange={(tabId) => setActiveTab(tabId as PublicTab)}
            />
          </div>
          <div
            role="tabpanel"
            id={`tabpanel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
            tabIndex={0}
            className="flex-1 overflow-y-auto p-6"
          >
            {SECTION_ORDER.filter((s) => s.type === activeSectionType).map(({ type, titleKey, emptyKey }) => {
              const section = sectionByType.get(type);
              return (
                <div key={type} className="space-y-4">
                  <h3 className="text-lg" style={{ fontWeight: 600, color: 'var(--app-text)' }}>
                    {t(titleKey)}
                  </h3>
                  {summaryLoading ? (
                    <InlineSpinner size="sm" />
                  ) : summaryError ? (
                    <div className="space-y-3 text-center py-12">
                      <p className="text-sm" style={{ color: 'var(--app-danger)' }}>
                        {t('explore.summaryLoadFailed')}
                      </p>
                      <button
                        onClick={() => void loadSummary()}
                        className="px-4 py-2 text-sm border rounded-lg hover:bg-[var(--app-glass-bg-strong)] transition-colors"
                        style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                      >
                        {t('common.retry')}
                      </button>
                    </div>
                  ) : section ? (
                    <MarkdownContent
                      content={section.summary.content}
                      streamingImages={section.images}
                      mediaToken={mediaToken}
                    />
                  ) : (
                    <p className="text-base leading-7" style={{ color: 'var(--app-text-subtle)' }}>
                      {t(emptyKey)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>,
  );
}
