import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAPIClient } from '@/lib/use-api-client';
import { useI18n } from '@/lib/i18n-context';
import { notifyError, notifySuccess } from '@/lib/notify';
import { resolveStreamToken } from '@/lib/stream-ticket';
import { resolveSummaryStreamBaseUrl, attachSseServerErrorListener } from '@/lib/summary-stream';
import { ApiError } from '@/types/api';
import type {
  ComparisonResult,
  SummaryItem,
  SummaryRegenerateType,
  LLMModel,
} from '@/types/api';

// 与 TaskDetail.tsx 同源的摘要 SSE 流时间参数(毫秒)。本切片为最小爆炸半径,
// 在此复制两个常量(regenerate 路径的常量声明保持不动,不跨簇改);DRY 合并待 regenerate 切片统一。
const SUMMARY_POLL_INTERVAL_MS = 2000; // 轮询 getSummaryComparison 间隔
const SUMMARY_OVERALL_TIMEOUT_MS = 120000; // 对比流程兜底总超时

export interface UseSummaryCompareParams {
  taskId: string | undefined;
  llmModels: LLMModel[];
  activeTab: string;
  buildSummaryState: (items: SummaryItem[]) => void;
}

export function useSummaryCompare({
  taskId,
  llmModels,
  activeTab,
  buildSummaryState,
}: UseSummaryCompareParams) {
  // taskId 别名 id:被搬运的函数体逐字引用 id,保留别名以零改函数体。
  const id = taskId;
  const client = useAPIClient();
  const { t } = useI18n();

  // ── 对比 state(逐字搬自 TaskDetail.tsx:188-196)──
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [compareSelectedModels, setCompareSelectedModels] = useState<string[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSummaryType, setCompareSummaryType] = useState<SummaryRegenerateType>("overview");
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[]>([]);
  const [compareActiveModel, setCompareActiveModel] = useState<string | null>(null);
  const [compareActivating, setCompareActivating] = useState(false);

  // ── 对比 ref(逐字搬自 197-199)──
  // 决策 A(忠实保真):本 hook 不加工作型卸载 effect。原 TaskDetail 共享卸载 effect 对这两个
  // 标量 ref 的清理是 mount 时快照=死 no-op(对比进行中卸载并不关流),此处保真不引入新行为;
  // 该既存泄漏(连同 imagesTimeoutRef 同款)立独立后续修复项。clearCompare/startCompare 重开时正常关流。
  const comparePollRef = useRef<number | null>(null);
  const compareStreamRef = useRef<EventSource | null>(null);
  const compareExpectedRef = useRef<number>(0);

  // ── 派生 memo(modelNameMap 逐字搬自 1617-1626;父级保留同款一份供 renderModelProvenance,
  //    同 llmModels 派生故同值;modelGroups 搬自 1627-1639)──
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

  // ── compare helper(逐字搬自 1683-1769,相对顺序保留:getModelKey 须先于依赖它的几个)──
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
  const getSummaryTypeByTab = useCallback((): SummaryRegenerateType => {
    if (activeTab === "keypoints") return "key_points";
    if (activeTab === "actions") return "action_items";
    return "overview";
  }, [activeTab]);

  // ── handler(逐字搬自 1259-1484)──
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

  // ── 安全网 effect(逐字搬自 935-943):SSE/轮询四处停 loading 之外的冗余兜底 ──
  useEffect(() => {
    if (!compareMode) return;
    const expected = compareExpectedRef.current;
    if (!expected) return;
    const completed = comparisonResults.filter((item) => item.status === "completed").length;
    if (completed >= expected) {
      setCompareLoading(false);
    }
  }, [compareMode, comparisonResults]);

  return {
    compareMode,
    compareSummaryType,
    compareDialogOpen,
    compareSelectedModels,
    compareError,
    compareLoading,
    compareActiveModel,
    comparisonResults,
    compareActivating,
    modelGroups,
    openCompareDialog,
    toggleCompareModel,
    startCompare,
    clearCompare,
    activateComparisonResult,
    getModelKey,
    getCompareStatus,
    getModelCompareLabel,
    setCompareDialogOpen,
    setCompareActiveModel,
  };
}
