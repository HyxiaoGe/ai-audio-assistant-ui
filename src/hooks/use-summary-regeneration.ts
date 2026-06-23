import { useCallback, useEffect, useRef, useState } from 'react';
import { useAPIClient } from '@/lib/use-api-client';
import { useI18n } from '@/lib/i18n-context';
import { notifyError } from '@/lib/notify';
import { resolveStreamToken } from '@/lib/stream-ticket';
import {
  resolveSummaryStreamBaseUrl,
  attachSseServerErrorListener,
  createSummaryStreamErrorHandler,
} from '@/lib/summary-stream';
import { createStreamThrottle } from '@/lib/stream-throttle';
import {
  extractPlaceholderDescription,
  findImagePlaceholders,
} from '@/lib/image-placeholder';
import { type ActionItem, parseActionItems, parseSummaryLines } from '@/lib/summary-parse';
import { ApiError } from '@/types/api';
import type {
  SummaryItem,
  SummaryRegenerateType,
  LLMModel,
  StreamingImage,
  SSEImageReadyEvent,
} from '@/types/api';
import {
  SUMMARY_POLL_INTERVAL_MS,
  SUMMARY_STREAM_FLUSH_MS,
  SUMMARY_CONNECTION_TIMEOUT_MS,
  SUMMARY_IMAGE_TIMEOUT_MS,
  SUMMARY_OVERALL_TIMEOUT_MS,
} from '@/lib/summary-constants';

interface KeyPoint {
  text: string;
  timeReference: string;
}

export interface UseSummaryRegenerationParams {
  taskId: string;
  llmModels: LLMModel[];
  summaryModelSelection: Record<SummaryRegenerateType, string | null>;
  summaryVersions: Record<SummaryRegenerateType, number>;
  actionItemLabels: { pendingAssignee: string; pendingDeadline: string };
  buildSummaryState: (items: SummaryItem[]) => void;
  setStreamingImages: React.Dispatch<React.SetStateAction<Map<string, StreamingImage>>>;
  imagesTimeoutRef: React.MutableRefObject<number | null>;
  setSummaryError: React.Dispatch<React.SetStateAction<string | null>>;
  summaryScrollRef: React.RefObject<HTMLDivElement | null>;
  summaryAutoScrollRef: React.MutableRefObject<boolean>;
  setSummaryOverviewMarkdown: React.Dispatch<React.SetStateAction<string>>;
  setKeyPointsMarkdown: React.Dispatch<React.SetStateAction<string>>;
  setKeyPoints: React.Dispatch<React.SetStateAction<KeyPoint[]>>;
  setActionItemsMarkdown: React.Dispatch<React.SetStateAction<string>>;
  setActionItems: React.Dispatch<React.SetStateAction<ActionItem[]>>;
}

export function useSummaryRegeneration({
  taskId,
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
}: UseSummaryRegenerationParams) {
  // taskId 别名 id:被搬运的函数体逐字引用 id,保留别名以零改函数体。
  const id = taskId;
  const client = useAPIClient();
  const { t } = useI18n();

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
  // flushSummaryStreamRef.current 在 setState 惰性初始化函数里是回调闭包,只有定时器到点时才调用
  // (运行时,非 render);行为与原 TaskDetail.tsx 逐字等价,规则无法区分此合法模式。
  /* eslint-disable react-hooks/refs */
  const [summaryStreamThrottle] = useState(() =>
    createStreamThrottle<SummaryRegenerateType>(
      (summaryType) => flushSummaryStreamRef.current(summaryType),
      SUMMARY_STREAM_FLUSH_MS
    )
  );
  /* eslint-enable react-hooks/refs */
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
    [actionItemLabels, setSummaryOverviewMarkdown, setKeyPointsMarkdown, setKeyPoints, setActionItemsMarkdown, setActionItems]
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
  }, [summaryScrollRef, summaryAutoScrollRef]);

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
  }, [scrollSummaryToBottom, updateSummaryFromStream, setStreamingImages]);

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
    [buildSummaryState, client, id, llmModels, scrollSummaryToBottom, summaryModelSelection, summaryStreaming, summaryStreamThrottle, summaryVersions, t, updateSummaryFromStream, setStreamingImages, setSummaryError, imagesTimeoutRef, summaryAutoScrollRef, summaryScrollRef]
  );

  // 卸载清理(决策 A:只搬「有效」部分——关流 + 清轮询 + 节流器 cancelAll;imagesTimeoutRef
  // 的死 no-op 清理留在父级不动,整套配图泄漏延到专门泄漏切片真修)。时序与原共享卸载 effect
  // 等价:mount-once 快照 ref、unmount 时清理。
  useEffect(() => {
    const summaryStreams = summaryStreamRef.current;
    const summaryPolls = summaryPollRef.current;
    return () => {
      (Object.keys(summaryStreams) as SummaryRegenerateType[]).forEach((type) => {
        summaryStreams[type]?.close();
        if (summaryPolls[type]) {
          window.clearInterval(summaryPolls[type] ?? undefined);
        }
      });
      // SSE delta 节流器的在途 flush 定时器一并丢弃(卸载后不得再 setState)。
      summaryStreamThrottle.cancelAll();
    };
  }, [summaryStreamThrottle]);

  return { summaryStreaming, summaryStreamContent, regenerateSummary };
}
