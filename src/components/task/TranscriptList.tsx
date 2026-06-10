import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { TranscriptWord } from '@/types/api';
import { useAudioStore } from '@/store/audio-store';
import { useI18n } from '@/lib/i18n-context';
import TranscriptItem from '@/components/task/TranscriptItem';
import ErrorState from '@/components/common/ErrorState';

export interface DisplayTranscriptSegment {
  id: string;
  speaker: string;
  startTime: string;
  endTime: string;
  startSeconds: number;
  endSeconds: number;
  content: string;
  words: TranscriptWord[] | null;
  avatarColor: string;
  isPolished: boolean;
  originalContent: string | null;
}

interface TranscriptListProps {
  transcript: DisplayTranscriptSegment[];
  transcriptLoading: boolean;
  isActiveAudio: boolean;
  onTimeClick: (time: string) => void;
  onEditSegment: (segmentId: string, newContent: string) => void;
  // 转写「这一次」拉取是否出错（超时/网络/网关等瞬态，非 40401）。用于把空态拆成
  // 「加载出错可重试」与「确实暂无内容」两种，避免一律误显示成「任务处理失败」。
  transcriptError?: boolean;
  // 任务是否仍在处理中（未 completed/failed）。处理中阶段（polishing/summarizing）转写可能尚未产出，
  // 后端对处理中任务返回的是 empty-success(items=[]) 而非 40401，若不识别就会被冤枉成「暂无内容/加载失败」。
  // 该标记优先级高于 transcriptError：处理中一律显示「转写生成中」，绝不在任务尚未完成时报失败。
  transcriptInProgress?: boolean;
  // 重试回调：局部重拉（loadTask），而非整页 window.location.reload。缺省退回整页刷新以兼容旧调用方。
  onRetry?: () => void;
  /** 只读模式：透传给每行 TranscriptItem，隐藏编辑按钮。默认 false。 */
  readOnly?: boolean;
}

/** 居中 spinner + 文案占位：转写「加载中」与「生成中」复用同一视觉，仅文案不同（均无失败语义、无重试）。 */
function TranscriptSpinner({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="glass-panel rounded-lg px-6 py-4 flex items-center gap-3">
        <div
          className="size-4 border-2 border-[var(--app-primary)] border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "var(--app-primary) transparent var(--app-primary) var(--app-primary)" }}
        />
        <span className="text-sm" style={{ color: "var(--app-text-muted)" }}>
          {label}
        </span>
      </div>
    </div>
  );
}

/**
 * 转写列表面板。
 *
 * 之所以独立成组件：它是整个详情页里唯一逐帧（audio timeupdate）变化的 currentTime 订阅者。
 * 把 currentTime 订阅 + 高亮派生 + 自动滚动机制都关进这里后，父组件 TaskDetail（2788 行）
 * 不再随播放每秒重渲染数次——逐帧重渲染被限制在本组件内，且行级 TranscriptItem 已 memo 化，
 * 只有正在高亮的那一行会重渲染。
 */
export function TranscriptList({
  transcript,
  transcriptLoading,
  isActiveAudio,
  onTimeClick,
  onEditSegment,
  transcriptError = false,
  transcriptInProgress = false,
  onRetry,
  readOnly = false,
}: TranscriptListProps) {
  const { t } = useI18n();
  const handleRetry = onRetry ?? (() => window.location.reload());
  const currentTime = useAudioStore((state) => state.currentTime);

  // 高亮直接在 render 期由 currentTime 派生（useMemo），而非 effect+setState。
  // 这样每帧只触发一次渲染，而不是「渲染→effect→setState→再渲染」两次——逐帧热路径上的关键收益。
  // 子行接收的是派生出的原始值（activeWordIndex/activeWordProgress），故每帧返回新对象不影响行级 memo。
  const { activeSegmentId, activeWordKey, activeWordProgress } = useMemo(() => {
    const empty = {
      activeSegmentId: null as string | null,
      activeWordKey: null as { segmentId: string; index: number } | null,
      activeWordProgress: null as number | null,
    };
    if (!isActiveAudio || transcript.length === 0) {
      return empty;
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
    if (!nextId || nextWordIndex === null || !nextSegment?.words) {
      return { ...empty, activeSegmentId: nextId };
    }
    const word = nextSegment.words[nextWordIndex];
    const wordDuration = Math.max(word.end_time - word.start_time, 0.001);
    const ratio = (currentTime - word.start_time) / wordDuration;
    return {
      activeSegmentId: nextId,
      activeWordKey: { segmentId: nextId, index: nextWordIndex },
      activeWordProgress: Math.min(1, Math.max(0, ratio)),
    };
  }, [currentTime, isActiveAudio, transcript]);

  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const autoScrollPauseUntilRef = useRef(0);
  const programmaticScrollRef = useRef(false);
  const resumeScrollTimerRef = useRef<number | null>(null);
  const activeSegmentIdRef = useRef<string | null>(null);

  const scrollToTranscriptItem = useCallback((segmentId: string) => {
    const container = transcriptScrollRef.current;
    if (!container) return;
    // 用 data-segment-id 在容器内定位行节点，而非给每行挂 ref——避免本组件每帧重渲染时
    // 整列 ref 反复 detach/reattach 的开销，也绕开「渲染期读取 ref.current」的 lint 限制。
    const node = container.querySelector(`[data-segment-id="${CSS.escape(segmentId)}"]`);
    if (!node) return;
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

  useEffect(() => {
    return () => {
      if (resumeScrollTimerRef.current) {
        window.clearTimeout(resumeScrollTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="flex-1 overflow-y-auto" ref={transcriptScrollRef}>
      {transcriptLoading ? (
        <TranscriptSpinner label={t("transcript.loading")} />
      ) : transcript.length > 0 ? (
        transcript.map((segment) => (
          <div key={segment.id} data-segment-id={segment.id}>
            <TranscriptItem
              segmentId={segment.id}
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
              onTimeClick={onTimeClick}
              onEdit={onEditSegment}
              isPolished={segment.isPolished}
              originalContent={segment.originalContent}
              readOnly={readOnly}
            />
          </div>
        ))
      ) : transcriptInProgress ? (
        // 任务仍在处理中（polishing/summarizing）：转写尚未产出/落库，后端返回 empty-success。
        // 一律显示「转写生成中」spinner（无重试、无失败语义），优先级高于 transcriptError——
        // 任务未完成前绝不把空态冤枉成「加载失败/暂无内容」。完成后该标记翻 false，再区分失败/暂无。
        <TranscriptSpinner label={t("task.transcriptGenerating")} />
      ) : transcriptError ? (
        // 转写这一次没拉到（超时/网络/网关瞬态）→ 明确「加载失败、可重试」，而非冤枉成「任务处理失败」。
        <ErrorState
          type="network"
          title={t("task.transcriptLoadFailed")}
          description={t("errors.networkFailedDesc")}
          onRetry={handleRetry}
          retryLabel={t("common.retry")}
        />
      ) : (
        // 拉取成功但确实没有转写（任务已完成但无内容，极少见）→ 中性提示，不报「失败」。
        <ErrorState
          type="general"
          title={t("task.transcriptEmpty")}
          description={t("task.transcriptEmptyDesc")}
          onRetry={handleRetry}
          retryLabel={t("common.retry")}
        />
      )}
    </div>
  );
}
