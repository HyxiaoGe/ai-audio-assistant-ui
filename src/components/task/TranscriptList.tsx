import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { useAudioStore } from '@/store/audio-store';
import { useI18n } from '@/lib/i18n-context';
import TranscriptItem from '@/components/task/TranscriptItem';
import ErrorState from '@/components/common/ErrorState';
import type { DisplayTranscriptSegment } from '@/lib/transcript-mapping';

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

// 深链跳播「定位」根因(4 次修复后由 ADBG 坐标实锤):转写每行带 content-visibility:auto +
// contain-intrinsic-size:auto 100px,未渲染行按 100px 估算。早期用 behavior:'smooth' 的大跨度
// scrollIntoView 会逐帧「穿过」沿途约 960 行 → 每行首次渲染、真实高度(~103px)替换估算 →
// 文档被撑高 ~3000px → 固定终点的平滑滚动结构性「欠冲」(ADBG:首滚落定后目标 rect.top 仍偏 +3448,
// 此前几次 resume-timer 重滚其实在对已长高的布局重新测量、逐步收敛 3448→547→~0)。
// 现改为「瞬时跳转(behavior:'auto')+有界 rAF 重定位收敛」:瞬时跳转不穿过中间行 → 不撑高文档 →
// 落点即居中,只剩目标周围约一个视口的小残差,由下面的 rAF 循环按 rect 差测量并收敛。

// 程序化滚动在途标志的「兜底」清旗时限。正常由 rAF 收敛循环自己清旗;此兜底仅防 rAF 长时间不触发
// (如标签页后台化时浏览器暂停 rAF)导致标志永久卡住、吞掉用户滚动。取宽松上界,非精度参数。
const PROGRAMMATIC_SCROLL_BACKSTOP_MS = 4000;
// 收敛「已居中」判定阈值(像素)。容忍 block:'center' 的亚像素取整与滚动锚定抖动;对高 CJK 行
// 取 max(4, 行高 2%)。漂移 ≤ 此值即认为到位,停止重定位。
const PROGRAMMATIC_SCROLL_TOL_PX = 4;
// 收敛重定位的帧上限(~0.5s,全程瞬时无感)。漂移迟迟不达 TOL 时由它硬收口,绝不无限循环。
const PROGRAMMATIC_SCROLL_MAX_FRAMES = 30;

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
function TranscriptListImpl({
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
    // 活动段 = 最后一个 startSeconds <= currentTime 的段。不再在 `currentTime <= endSeconds`
    // 处提前 break:转写段通常连续(prev.end == next.start),若在 prev 处因 `<= prev.end` 命中
    // 而 break,恰好落在边界的时刻会归属上一段——从搜索命中深链跳播到段 start 时就会停在上一句
    // (实测:点「会接替库克」停到上一句)。改成"以它为起点的那段优先",边界时刻正确归属下一段。
    // gap 场景不变(currentTime 落在空隙时,下一段 start > currentTime 会先 break,仍保留上一段)。
    let nextSegment: DisplayTranscriptSegment | null = null;
    for (const segment of transcript) {
      if (currentTime < segment.startSeconds) {
        break;
      }
      nextSegment = segment;
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
  // 程序化(自动)滚动在途标志。置真期间，容器自身派发的 scroll 事件一律视为「我们自己的滚动帧」
  // 而非用户滚动，绝不触发「3s 暂停 + 恢复」。由 rAF 收敛循环清旗，backstop 仅兜底。
  const programmaticScrollRef = useRef(false);
  const programmaticBackstopRef = useRef<number | null>(null);
  // 收敛重定位的 rAF id（单一在途循环）。重入/手势/卸载时据此取消，绝不让两个循环争用 scrollTop。
  const convergeRafRef = useRef<number | null>(null);
  const resumeScrollTimerRef = useRef<number | null>(null);
  const activeSegmentIdRef = useRef<string | null>(null);

  // 统一拆卸程序化滚动：清标志 + 取消在途 rAF 收敛 + 取消 backstop。是唯一的「收尾/中止」入口，
  // 保证三者原子地一起归零（收敛完成、用户手势中止、重入、卸载、兜底均经此处）。
  const clearProgrammaticScroll = useCallback(() => {
    programmaticScrollRef.current = false;
    if (convergeRafRef.current != null) {
      cancelAnimationFrame(convergeRafRef.current);
      convergeRafRef.current = null;
    }
    if (programmaticBackstopRef.current) {
      window.clearTimeout(programmaticBackstopRef.current);
      programmaticBackstopRef.current = null;
    }
  }, []);

  const scrollToTranscriptItem = useCallback((segmentId: string) => {
    const container = transcriptScrollRef.current;
    if (!container) return;
    // 用 data-segment-id 在容器内定位行节点，而非给每行挂 ref——避免本组件每帧重渲染时
    // 整列 ref 反复 detach/reattach 的开销，也绕开「渲染期读取 ref.current」的 lint 限制。
    const node = container.querySelector(`[data-segment-id="${CSS.escape(segmentId)}"]`);
    if (!node) return;

    // 重入幂等:先拆掉任何在途的收敛循环/兜底,再重新武装。绝不让两个循环同时争用 scrollTop
    // (新深链或播放推进改变活动段时,旧循环必须先死)。
    clearProgrammaticScroll();
    programmaticScrollRef.current = true;
    // 兜底:仅当 rAF 因标签页后台化等长时间不触发、收敛循环没能清旗时,防止标志永久卡住吞掉用户滚动。
    programmaticBackstopRef.current = window.setTimeout(clearProgrammaticScroll, PROGRAMMATIC_SCROLL_BACKSTOP_MS);

    // 初次「瞬时」跳转:behavior:'auto' 不逐帧穿过沿途行,故不会首次渲染它们、不撑高文档——这正是
    // 根治旧 smooth 欠冲漂移的要害(见文件顶部注释)。落点按当前(估算)布局即居中。
    node.scrollIntoView({ behavior: "auto", block: "center" });

    // 有界 rAF 收敛:吸收「目标周围约一个视口的行首次渲染」带来的小残差。每帧重新测量行相对容器的
    // 居中漂移(用 rect 差,绝不拿 viewport 相对的 rect.top 跟容器相对的 scrollTop 比),漂移 ≤ TOL
    // 或达帧上限或连续两帧不再下降即止。全程 programmaticScrollRef 保持真,我们自己的 scroll 帧被
    // handleScroll 屏蔽——这是「不二次定位」的关键不变量。
    let iters = 0;
    let prevAbsDrift = Number.POSITIVE_INFINITY;
    let stall = 0;
    const step = () => {
      const c = transcriptScrollRef.current;
      const n = c?.querySelector(`[data-segment-id="${CSS.escape(segmentId)}"]`) as HTMLElement | null;
      if (!c || !n) {
        clearProgrammaticScroll();
        return;
      }
      const cRect = c.getBoundingClientRect();
      const nRect = n.getBoundingClientRect();
      const drift = nRect.top - cRect.top - (c.clientHeight - nRect.height) / 2;
      const absDrift = Math.abs(drift);
      const tol = Math.max(PROGRAMMATIC_SCROLL_TOL_PX, Math.round(nRect.height * 0.02));
      if (absDrift <= tol || iters >= PROGRAMMATIC_SCROLL_MAX_FRAMES) {
        clearProgrammaticScroll();
        return;
      }
      // 连续两帧漂移不再下降(病态/振荡布局):提前退出,避免烧满帧上限或可见抖动。
      if (absDrift >= prevAbsDrift) {
        stall += 1;
      } else {
        stall = 0;
      }
      if (stall >= 2) {
        clearProgrammaticScroll();
        return;
      }
      prevAbsDrift = absDrift;
      n.scrollIntoView({ behavior: "auto", block: "center" });
      iters += 1;
      convergeRafRef.current = requestAnimationFrame(step);
    };
    convergeRafRef.current = requestAnimationFrame(step);
  }, [clearProgrammaticScroll]);

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
      // 用户真实手势/滚动:若有程序化收敛在途,立即中止它(原生 smooth 会被用户输入打断,手写 rAF
      // 须显式接线),用户优先。注:handleScroll 在程序化在途时已 early-return,故经它进来时标志必为假;
      // 只有 wheel/touchmove/pointerdown 才可能在收敛途中触发中止。
      if (programmaticScrollRef.current) clearProgrammaticScroll();
      autoScrollPauseUntilRef.current = Date.now() + 3000;
      scheduleAutoScrollResume();
    };

    const handleScroll = () => {
      // 程序化滚动在途:本帧是我们自己的 scrollIntoView 产生的,绝不当成用户滚动。
      // 标志由 rAF 收敛循环(或 backstop)清掉,绝不在此处续命/计时。
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
  }, [scheduleAutoScrollResume, clearProgrammaticScroll]);

  useEffect(() => {
    return () => {
      if (resumeScrollTimerRef.current) {
        window.clearTimeout(resumeScrollTimerRef.current);
      }
      if (programmaticBackstopRef.current) {
        window.clearTimeout(programmaticBackstopRef.current);
      }
      // 卸载时取消在途收敛 rAF,避免回调在已脱离的容器上跑。
      if (convergeRafRef.current != null) {
        cancelAnimationFrame(convergeRafRef.current);
      }
    };
  }, []);

  return (
    <div className="flex-1 overflow-y-auto" ref={transcriptScrollRef}>
      {transcriptLoading ? (
        <TranscriptSpinner label={t("transcript.loading")} />
      ) : transcript.length > 0 ? (
        transcript.map((segment) => (
          // content-visibility:auto — 视口外转写行跳过布局/绘制(长转写 1700+ 行、上万节点时
          // 浏览器渲染成本的大头)。contain-intrinsic-size 用「auto 100px」而非固定值:首测前以
          // 100px 估算占位,实测后记忆真实尺寸——减少长距滚动时 scroll-anchoring 的尺寸修正被
          // 上方「3s 自动滚动暂停」机制误判为用户滚动(可自愈,但记忆尺寸能减少触发)。
          // Safari 不支持 content-visibility:两个属性整体被忽略,按普通块原样渲染降级,无行为差异。
          <div
            key={segment.id}
            data-segment-id={segment.id}
            className="[content-visibility:auto] [contain-intrinsic-size:auto_100px]"
          >
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

// memo:摘要再生 SSE 流式期间父组件(TaskDetail)每次 flush 都整页重渲染;本组件的 props
// 全部引用稳定(transcript state 引用不变、回调经 useCallback/模块级常量提稳、其余为原始值),
// 浅比较直接跳过长转写(1700+ 行)的整列 reconcile。内部 currentTime 订阅来自 zustand、
// 不经 props,memo 不影响——播放高亮照常逐帧驱动,且行级 TranscriptItem 已 memo 收口。
export const TranscriptList = memo(TranscriptListImpl);
