"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ArrowLeft, Globe } from 'lucide-react';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import EmptyState from '@/components/common/EmptyState';
import { PlayerBarContainer } from '@/components/task/PlayerBarContainer';
import { useAPIClient } from '@/lib/use-api-client';
import { useI18n } from '@/lib/i18n-context';
import { usePublicMediaToken } from '@/lib/media-url';
import { useAudioStore } from '@/store/audio-store';
import { extractPlaceholderDescription } from '@/lib/image-placeholder';
import { ApiError } from '@/types/api';
import type {
  PublicSummaryItem,
  PublicTaskDetail as PublicTaskDetailData,
  PublicTranscriptItem,
  StreamingImage,
  SummaryType,
} from '@/types/api';

// 与 TaskDetail 同款:重渲染依赖移出首屏 chunk,内容到位时通常已加载完
const MarkdownContent = dynamic(
  () => import('@/components/task/MarkdownContent').then((m) => m.MarkdownContent),
  { ssr: false },
);

const SECTION_ORDER: { type: SummaryType; titleKey: string }[] = [
  { type: 'overview', titleKey: 'explore.summaryTitle' },
  { type: 'key_points', titleKey: 'explore.keyPointsTitle' },
  { type: 'action_items', titleKey: 'explore.actionItemsTitle' },
];

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** 公开页是静态终态:非 ready 一律按 failed 展示回退文案,绝不挂无限 spinner。 */
function buildPublicStreamingImages(summary: PublicSummaryItem): Map<string, StreamingImage> {
  const map = new Map<string, StreamingImage>();
  for (const img of summary.images ?? []) {
    map.set(img.placeholder, {
      placeholder: img.placeholder,
      description: extractPlaceholderDescription(img.placeholder),
      url: img.url,
      status: img.status === 'ready' ? 'ready' : 'failed',
    });
  }
  return map;
}

interface PublicTaskDetailProps {
  isAuthenticated: boolean;
  onOpenLogin: () => void;
  onToggleTheme?: () => void;
}

export default function PublicTaskDetail({ isAuthenticated, onOpenLogin, onToggleTheme }: PublicTaskDetailProps) {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const client = useAPIClient();
  const mediaToken = usePublicMediaToken(id);

  const [task, setTask] = useState<PublicTaskDetailData | null>(null);
  const [transcripts, setTranscripts] = useState<PublicTranscriptItem[]>([]);
  const [summaries, setSummaries] = useState<PublicSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    setLoadError(false);
    try {
      const [detail, transcript, summary] = await Promise.all([
        client.getPublicTask(id),
        client.getPublicTranscript(id),
        client.getPublicSummary(id),
      ]);
      setTask(detail);
      setTranscripts(transcript.items);
      setSummaries(summary.items);
    } catch (err) {
      // 40401 = 不存在/未公开/已收回 → 终态 notFound;其余(网络/5xx)→ 可重试
      if (err instanceof ApiError && err.code === 40401) setNotFound(true);
      else setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [client, id]);

  useEffect(() => {
    void load();
  }, [load]);

  // ===== 音频播放(与 TaskDetail 同款 audio-store 集成;媒体票走公开通道) =====
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const audioDuration = useAudioStore((s) => s.duration);
  const currentSrc = useAudioStore((s) => s.src);
  const setSource = useAudioStore((s) => s.setSource);
  const togglePlayback = useAudioStore((s) => s.toggle);
  const play = useAudioStore((s) => s.play);
  const seek = useAudioStore((s) => s.seek);

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

  const isActiveAudio = Boolean(task?.audio_url && currentSrc === task.audio_url);
  const duration = isActiveAudio
    ? (audioDuration || task?.duration_seconds || 0)
    : (task?.duration_seconds || 0);
  const displayIsPlaying = isActiveAudio ? isPlaying : false;

  const sections = useMemo(
    () =>
      SECTION_ORDER.flatMap(({ type, titleKey }) => {
        const summary = summaries.find((s) => s.summary_type === type);
        return summary ? [{ type, titleKey, summary, images: buildPublicStreamingImages(summary) }] : [];
      }),
    [summaries],
  );

  const shell = (children: ReactNode) => (
    <div className="h-screen flex flex-col" style={{ background: 'var(--app-bg)' }}>
      <Header
        isAuthenticated={isAuthenticated}
        onOpenLogin={onOpenLogin}
        onToggleTheme={onToggleTheme}
      />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );

  if (loading) {
    return shell(
      <div className="flex items-center justify-center py-24">
        <div
          className="size-5 border-2 rounded-full animate-spin"
          style={{ borderColor: 'var(--app-primary) transparent var(--app-primary) var(--app-primary)' }}
        />
      </div>,
    );
  }

  if (notFound) {
    return shell(
      <EmptyState
        variant="default"
        title={t('explore.notFoundTitle')}
        description={t('explore.notFoundDescription')}
        action={{ label: t('explore.backToExplore'), onClick: () => router.push('/explore'), variant: 'primary' }}
      />,
    );
  }

  if (loadError || !task) {
    return shell(
      <div className="text-center py-24 space-y-3">
        <p className="text-sm" style={{ color: 'var(--app-danger)' }}>{t('explore.loadFailed')}</p>
        <button
          onClick={() => void load()}
          className="px-4 py-2 text-sm border rounded-lg hover:bg-[var(--app-glass-bg-strong)] transition-colors"
          style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
        >
          {t('explore.retry')}
        </button>
      </div>,
    );
  }

  return shell(
    <div className="space-y-6">
      {/* 返回 + 标题 + 公开徽标 */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => router.push('/explore')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-[var(--app-glass-bg-strong)] transition-colors"
          style={{ color: 'var(--app-text-muted)' }}
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm" style={{ fontWeight: 500 }}>{t('explore.backToExplore')}</span>
        </button>
        <h1 className="text-xl flex-1 text-center" style={{ fontWeight: 600, color: 'var(--app-text)' }}>
          {task.title}
        </h1>
        <span
          className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-full"
          style={{ background: 'var(--app-glass-bg-strong)', color: 'var(--app-primary)' }}
        >
          <Globe className="w-3.5 h-3.5" />
          {t('task.visibilityPublic')}
        </span>
      </div>

      {/* 播放条(audio_url 经公开媒体票,token 注入由 audio-store 统一处理) */}
      {task.audio_url && (
        <PlayerBarContainer
          isActiveAudio={isActiveAudio}
          duration={duration}
          isPlaying={displayIsPlaying}
          onPlayPause={handlePlayPause}
          onSeek={handleSeek}
          youtube={null}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* 左:转写(轻量只读列表) */}
        <section className="border rounded-xl p-5" style={{ borderColor: 'var(--app-border)', background: 'var(--app-glass-bg)' }}>
          <h2 className="text-base mb-4" style={{ fontWeight: 600, color: 'var(--app-text)' }}>
            {t('explore.transcriptTitle')}
          </h2>
          <div className="space-y-4">
            {transcripts.map((item) => (
              <div key={item.sequence} className="text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <button
                    onClick={() => handleSeek(item.start_time)}
                    className="text-xs tabular-nums hover:underline"
                    style={{ color: 'var(--app-primary)' }}
                  >
                    {formatClock(item.start_time)}
                  </button>
                  {item.speaker_label && (
                    <span className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
                      {item.speaker_label}
                    </span>
                  )}
                </div>
                <p style={{ color: 'var(--app-text)' }}>{item.content}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 右:摘要/要点/行动项(MarkdownContent 全套配图管线复用) */}
        <div className="space-y-6">
          {sections.map(({ type, titleKey, summary, images }) => (
            <section
              key={type}
              className="border rounded-xl p-5"
              style={{ borderColor: 'var(--app-border)', background: 'var(--app-glass-bg)' }}
            >
              <h2 className="text-base mb-4" style={{ fontWeight: 600, color: 'var(--app-text)' }}>
                {t(titleKey)}
              </h2>
              <MarkdownContent content={summary.content} streamingImages={images} mediaToken={mediaToken} />
            </section>
          ))}
        </div>
      </div>
    </div>,
  );
}
