"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import EmptyState from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAPIClient } from "@/lib/use-api-client";
import { useI18n } from "@/lib/i18n-context";
import {
  ApiError,
  StatsServicesOverviewResponse,
  StatsTasksOverviewResponse,
} from "@/types/api";

type TimeRangeOption = "today" | "week" | "month" | "all" | "custom";

interface StatsProps {
  isAuthenticated: boolean;
  onOpenLogin: () => void;
  language?: "zh" | "en";
  onToggleTheme?: () => void;
}

type AppliedRange = {
  start: string;
  end: string;
};

type ServiceUsageBase = {
  call_count?: number;
  success_count?: number;
  failure_count?: number;
  pending_count?: number;
  processing_count?: number;
};

const getItemCallCount = (item: ServiceUsageBase) => {
  if (Number.isFinite(item.call_count)) return item.call_count as number;
  const counts = [
    item.success_count,
    item.failure_count,
    item.pending_count,
    item.processing_count,
  ].filter((value) => Number.isFinite(value)) as number[];
  return counts.reduce((sum, value) => sum + value, 0);
};

const getItemSuccessRate = (
  item: ServiceUsageBase & { success_rate?: number }
) => {
  if (Number.isFinite(item.success_rate)) return item.success_rate as number;
  const total = getItemCallCount(item);
  if (!total || !Number.isFinite(item.success_count)) return 0;
  return ((item.success_count || 0) / total) * 100;
};

const getItemFailureRate = (
  item: ServiceUsageBase & { failure_rate?: number }
) => {
  if (Number.isFinite(item.failure_rate)) return item.failure_rate as number;
  const total = getItemCallCount(item);
  if (!total || !Number.isFinite(item.failure_count)) return 0;
  return ((item.failure_count || 0) / total) * 100;
};

const normalizeProviderUsage = <
  T extends ServiceUsageBase & {
    provider?: string | null;
    service_type?: string;
  }
>(
  breakdown: T[] | Record<string, T> | undefined,
  fallbackServiceType: string
) => {
  if (!breakdown) return [];
  const items = Array.isArray(breakdown)
    ? breakdown.map((item) => ({
        ...item,
        service_type: item.service_type || fallbackServiceType,
      }))
    : typeof breakdown === "object"
      ? Object.entries(breakdown).map(([provider, value]) => ({
          provider: value.provider || provider,
          service_type: value.service_type || fallbackServiceType,
          ...value,
        }))
      : [];
  return [...items].sort((a, b) => getItemCallCount(b) - getItemCallCount(a));
};

const STAGE_ORDER = [
  "resolve_youtube",
  "download",
  "transcode",
  "upload_storage",
  "transcribe",
  "summarize",
];
const STAGE_ORDER_MAP = new Map(
  STAGE_ORDER.map((stage, index) => [stage, index])
);



export default function Stats({
  isAuthenticated,
  onOpenLogin,
  language = "zh",
  onToggleTheme = () => {},
}: StatsProps) {
  const client = useAPIClient();
  const { t } = useI18n();

  const [timeRange, setTimeRange] = useState<TimeRangeOption>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [appliedRange, setAppliedRange] = useState<AppliedRange | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);
  const [serviceOverview, setServiceOverview] =
    useState<StatsServicesOverviewResponse | null>(null);
  const [taskOverview, setTaskOverview] =
    useState<StatsTasksOverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asrProvidersOpen, setAsrProvidersOpen] = useState(true);
  const [llmProvidersOpen, setLlmProvidersOpen] = useState(true);

  const timeQuery = useMemo(() => {
    if (timeRange === "custom") {
      if (!appliedRange) return null;
      return {
        start_date: `${appliedRange.start}T00:00:00Z`,
        end_date: `${appliedRange.end}T23:59:59Z`,
      };
    }
    return { time_range: timeRange };
  }, [timeRange, appliedRange]);

  const handleApplyCustomRange = () => {
    if (!customStart || !customEnd) {
      setCustomError(t("stats.customRangeIncomplete"));
      return;
    }
    if (customStart > customEnd) {
      setCustomError(t("stats.customRangeInvalid"));
      return;
    }
    setCustomError(null);
    setAppliedRange({ start: customStart, end: customEnd });
  };

  const fetchStats = useCallback(
    async (
      query: { time_range?: string; start_date?: string; end_date?: string }
    ) => {
      setLoading(true);
      setError(null);
      try {
        const [serviceOverviewRes, taskOverviewRes] =
          await Promise.all([
            client.getServiceStatsOverview(query),
            client.getTaskStatsOverview(query),
          ]);

        setServiceOverview(serviceOverviewRes);
        setTaskOverview(taskOverviewRes);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
          if (err.code >= 40100 && err.code < 40200) {
            onOpenLogin();
          }
        } else {
          setError(err instanceof Error ? err.message : t("stats.loadFailed"));
        }
      } finally {
        setLoading(false);
      }
    },
    [client, onOpenLogin, t]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setServiceOverview(null);
      setTaskOverview(null);
      setLoading(false);
      setError(null);
      return;
    }
    if (!timeQuery) return;
    fetchStats(timeQuery);
  }, [fetchStats, isAuthenticated, timeQuery]);

  const formatPercent = (value: number) => {
    const formatter = new Intl.NumberFormat(
      language === "zh" ? "zh-CN" : "en-US",
      {
        maximumFractionDigits: 1,
      }
    );
    return `${formatter.format(value)}%`;
  };

  const formatPercentValue = (value?: number) => {
    if (!Number.isFinite(value)) return "--";
    return formatPercent(value as number);
  };

  const formatSeconds = (value: number) => {
    if (!Number.isFinite(value)) return "--";
    if (value < 60) {
      return t("stats.seconds", { count: value.toFixed(1) });
    }
    const minutes = Math.round(value / 60);
    if (minutes < 60) return t("time.minutes", { count: minutes });
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder === 0
      ? t("time.hours", { count: hours })
      : t("time.hoursMinutes", { hours, minutes: remainder });
  };

  const serviceTypeLabel = (serviceType: string) => {
    const key = `stats.serviceType.${serviceType}`;
    const label = t(key);
    return label === key ? serviceType : label;
  };

  const providerLabel = (provider: string) => {
    const key = `stats.provider.${provider}`;
    const label = t(key);
    return label === key ? provider : label;
  };

  const stageLabel = (stage: string) => {
    const key = `stats.stage.${stage}`;
    const label = t(key);
    return label === key ? stage : label;
  };


  const statusItems = useMemo(() => {
    if (!taskOverview) return [];
    return [
      {
        key: "pending",
        label: t("stats.status.pending"),
        value: taskOverview.status_distribution.pending ?? 0,
      },
      {
        key: "processing",
        label: t("stats.status.processing"),
        value: taskOverview.status_distribution.processing ?? 0,
      },
      {
        key: "completed",
        label: t("stats.status.completed"),
        value: taskOverview.status_distribution.completed ?? 0,
      },
      {
        key: "failed",
        label: t("stats.status.failed"),
        value: taskOverview.status_distribution.failed ?? 0,
      },
    ];
  }, [taskOverview, t]);

  const stageBreakdown = useMemo(() => {
    if (!taskOverview) return [];
    const entries = Object.entries(taskOverview.processing_time_by_stage || {});
    return entries
      .map(([stage, value]) => ({
        stage,
        value,
        order: STAGE_ORDER_MAP.get(stage) ?? 99,
      }))
      .sort((a, b) =>
        a.order !== b.order ? a.order - b.order : b.value - a.value
      );
  }, [taskOverview]);

  const serviceBreakdown = useMemo(() => {
    if (!serviceOverview) return [];
    const breakdown = serviceOverview.usage_by_service_type;
    const items = Array.isArray(breakdown)
      ? breakdown
      : breakdown && typeof breakdown === "object"
        ? Object.entries(breakdown).map(([service_type, value]) => ({
            ...value,
            service_type,
          }))
        : [];
    return [...items].sort(
      (a, b) => getItemCallCount(b) - getItemCallCount(a)
    );
  }, [serviceOverview]);

  const getFallbackProviderUsage = useCallback(
    (serviceType: "asr" | "llm") => {
      const fallback = serviceOverview?.usage_by_provider;
      if (!fallback) return [];
      const items = Array.isArray(fallback)
        ? fallback.filter((item) => item.service_type === serviceType)
        : Object.entries(fallback)
            .filter(([, value]) => value.service_type === serviceType)
            .map(([provider, value]) => ({
              ...value,
              provider: value.provider || provider,
              service_type: value.service_type || serviceType,
            }));
      return normalizeProviderUsage(items, serviceType);
    },
    [serviceOverview]
  );

  const asrProviderUsage = useMemo(() => {
    const direct = normalizeProviderUsage(
      serviceOverview?.asr_usage_by_provider,
      "asr"
    );
    if (direct.length) return direct;
    return getFallbackProviderUsage("asr");
  }, [getFallbackProviderUsage, serviceOverview]);

  const llmProviderUsage = useMemo(() => {
    const direct = normalizeProviderUsage(
      serviceOverview?.llm_usage_by_provider,
      "llm"
    );
    if (direct.length) return direct;
    return getFallbackProviderUsage("llm");
  }, [getFallbackProviderUsage, serviceOverview]);

  const asrProviderTotal = useMemo(
    () => asrProviderUsage.reduce((sum, item) => sum + getItemCallCount(item), 0),
    [asrProviderUsage]
  );
  const llmProviderTotal = useMemo(
    () => llmProviderUsage.reduce((sum, item) => sum + getItemCallCount(item), 0),
    [llmProviderUsage]
  );

  const totalServiceCalls = useMemo(() => {
    if (!serviceOverview) return 0;
    if (Number.isFinite(serviceOverview.total_calls)) {
      return serviceOverview.total_calls;
    }
    return serviceBreakdown.reduce((sum, item) => sum + getItemCallCount(item), 0);
  }, [serviceOverview, serviceBreakdown]);

  const overallServiceRates = useMemo(() => {
    if (!serviceBreakdown.length) return null;
    const total = serviceBreakdown.reduce(
      (sum, item) => sum + getItemCallCount(item),
      0
    );
    if (!total) return null;
    const weightedSuccess =
      serviceBreakdown.reduce(
        (sum, item) => sum + getItemCallCount(item) * getItemSuccessRate(item),
        0
      ) / total;
    const weightedFailure =
      serviceBreakdown.reduce(
        (sum, item) => sum + getItemCallCount(item) * getItemFailureRate(item),
        0
      ) / total;
    return {
      success: weightedSuccess,
      failure: weightedFailure,
    };
  }, [serviceBreakdown]);

  const hasData = !!serviceOverview || !!taskOverview;

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--app-bg)" }}>
      <Header
        isAuthenticated={isAuthenticated}
        onOpenLogin={onOpenLogin}
        onToggleTheme={onToggleTheme}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto px-8 py-6" style={{ background: "var(--app-bg)" }}>
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-h2" style={{ color: "var(--app-text)" }}>
                {t("stats.title")}
              </h2>
              <p className="text-sm" style={{ color: "var(--app-text-muted)" }}>
                {t("stats.subtitle")}
              </p>
            </div>
          </div>

          {!isAuthenticated ? (
            <EmptyState
              variant="default"
              title={t("stats.loginRequiredTitle")}
              description={t("stats.loginRequiredDesc")}
              action={{
                label: t("dashboard.goLogin"),
                onClick: onOpenLogin,
                variant: "primary",
              }}
            />
          ) : (
            <>
              <div className="glass-panel rounded-2xl p-4 mb-6">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="space-y-2">
                    <p className="text-xs text-[var(--app-text-muted)]">
                      {t("stats.timeRangeLabel")}
                    </p>
                    <Select
                      value={timeRange}
                      onValueChange={(value) => {
                        setTimeRange(value as TimeRangeOption);
                        setCustomError(null);
                      }}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">
                          {t("stats.timeRangeOptions.today")}
                        </SelectItem>
                        <SelectItem value="week">
                          {t("stats.timeRangeOptions.week")}
                        </SelectItem>
                        <SelectItem value="month">
                          {t("stats.timeRangeOptions.month")}
                        </SelectItem>
                        <SelectItem value="all">
                          {t("stats.timeRangeOptions.all")}
                        </SelectItem>
                        <SelectItem value="custom">
                          {t("stats.timeRangeOptions.custom")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {timeRange === "custom" && (
                    <>
                      <div className="space-y-2">
                        <p className="text-xs text-[var(--app-text-muted)]">
                          {t("stats.startDate")}
                        </p>
                        <input
                          type="date"
                          value={customStart}
                          onChange={(e) => setCustomStart(e.target.value)}
                          className="glass-control h-9 rounded-md px-3 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs text-[var(--app-text-muted)]">
                          {t("stats.endDate")}
                        </p>
                        <input
                          type="date"
                          value={customEnd}
                          onChange={(e) => setCustomEnd(e.target.value)}
                          className="glass-control h-9 rounded-md px-3 text-sm"
                        />
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleApplyCustomRange}
                      >
                        {t("stats.apply")}
                      </Button>
                    </>
                  )}

                </div>
                {customError && (
                  <p className="mt-2 text-xs text-[var(--app-danger)]">
                    {customError}
                  </p>
                )}
              </div>

              {error && (
                <div
                  className="rounded-xl border px-4 py-3 text-sm mb-6"
                  style={{
                    borderColor: "var(--app-danger-border)",
                    color: "var(--app-danger)",
                    background: "var(--app-danger-bg-soft)",
                  }}
                >
                  {error}
                </div>
              )}

              {!loading && !hasData && (
                <div className="text-sm text-[var(--app-text-muted)]">
                  {t("stats.empty")}
                </div>
              )}

              <section className="space-y-4 mb-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-h3" style={{ color: "var(--app-text)" }}>
                    {t("stats.serviceSection")}
                  </h3>
                  {loading && (
                    <span className="text-xs text-[var(--app-text-muted)]">
                      {t("common.loading")}...
                    </span>
                  )}
                </div>

                <div className="glass-panel rounded-2xl p-6 space-y-5">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-[var(--app-text-muted)]">
                        {t("stats.totalCalls")}
                      </p>
                      <p className="text-2xl font-semibold text-[var(--app-text)]">
                        {serviceOverview ? totalServiceCalls : "--"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--app-text-muted)]">
                        {t("stats.successRate")}
                      </p>
                      <p className="text-xl font-semibold text-[var(--app-text)]">
                        {overallServiceRates
                          ? formatPercentValue(overallServiceRates.success)
                          : "--"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--app-text-muted)]">
                        {t("stats.failureRate")}
                      </p>
                      <p className="text-xl font-semibold text-[var(--app-text)]">
                        {overallServiceRates
                          ? formatPercentValue(overallServiceRates.failure)
                          : "--"}
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-4" style={{ borderColor: "var(--app-glass-border)" }}>
                    <p className="text-sm font-medium text-[var(--app-text)] mb-3">
                      {t("stats.serviceBreakdown")}
                    </p>
                    {serviceBreakdown.length === 0 ? (
                      <p className="text-xs text-[var(--app-text-muted)]">--</p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {serviceBreakdown.map((item, index) => (
                          <div
                            key={`${item.service_type}-${index}`}
                            className="rounded-xl border px-4 py-3 space-y-2 relative overflow-hidden"
                            style={{ borderColor: "var(--app-glass-border)" }}
                          >
                            <span
                              className="absolute inset-y-0 left-0 w-1"
                              style={{
                                background:
                                  item.service_type === "asr"
                                    ? "var(--app-primary)"
                                    : "var(--app-purple)",
                              }}
                            />
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[var(--app-text)] font-semibold">
                                {serviceTypeLabel(item.service_type)}
                              </span>
                              <span className="text-[var(--app-text-muted)]">
                                {t("stats.callCount", {
                                  count: getItemCallCount(item),
                                })}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2 text-[11px] text-[var(--app-text-muted)]">
                              <span className="rounded-full bg-[var(--app-success-bg)] px-2 py-0.5 text-[var(--app-success)]">
                                {t("stats.successRate")} {formatPercentValue(getItemSuccessRate(item))}
                              </span>
                              <span className="rounded-full bg-[var(--app-danger-bg-soft)] px-2 py-0.5 text-[var(--app-danger-strong)]">
                                {t("stats.failureRate")} {formatPercentValue(getItemFailureRate(item))}
                              </span>
                            </div>
                            {(item.success_count ||
                              item.failure_count ||
                              item.processing_count ||
                              item.pending_count) && (
                              <p className="text-[11px] text-[var(--app-text-muted)]">
                                {t("stats.statusCounts", {
                                  success: item.success_count || 0,
                                  failure: item.failure_count || 0,
                                  processing: item.processing_count || 0,
                                  pending: item.pending_count || 0,
                                })}
                              </p>
                            )}
                            <div className="grid gap-1 text-[11px] text-[var(--app-text-muted)]">
                              <div className="flex items-center justify-between">
                                <span>{t("stats.avgStageSeconds")}</span>
                                <span className="text-[var(--app-text)]">
                                  {formatSeconds(item.avg_stage_seconds)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>{t("stats.medianStageSeconds")}</span>
                                <span className="text-[var(--app-text)]">
                                  {formatSeconds(item.median_stage_seconds)}
                                </span>
                              </div>
                              {Number.isFinite(item.total_audio_duration_seconds) &&
                                (item.total_audio_duration_seconds ?? 0) > 0 && (
                                <div className="flex items-center justify-between">
                                  <span>{t("stats.totalAudioDuration")}</span>
                                  <span className="text-[var(--app-text)]">
                                    {formatSeconds(item.total_audio_duration_seconds!)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="glass-panel rounded-2xl p-6 space-y-4">
                  <p className="text-sm font-medium text-[var(--app-text)]">
                    {t("stats.providerBreakdown")}
                  </p>
                  {asrProviderUsage.length === 0 && llmProviderUsage.length === 0 ? (
                    <p className="text-xs text-[var(--app-text-muted)]">--</p>
                  ) : (
                    <div className="grid gap-6 md:grid-cols-2">
                      <div
                        className="rounded-2xl border p-4 space-y-3"
                        style={{ borderColor: "var(--app-glass-border)" }}
                      >
                        <button
                          type="button"
                          onClick={() => setAsrProvidersOpen((prev) => !prev)}
                          className="w-full flex items-center justify-between text-left"
                          aria-expanded={asrProvidersOpen}
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-[var(--app-text)]">
                              {t("stats.providerBreakdownAsr")}
                            </p>
                            <span className="text-xs text-[var(--app-text-muted)]">
                              {t("stats.callCount", { count: asrProviderTotal })}
                            </span>
                          </div>
                          {asrProvidersOpen ? (
                            <ChevronUp className="w-4 h-4 text-[var(--app-text-muted)]" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-[var(--app-text-muted)]" />
                          )}
                        </button>
                        {asrProviderUsage.length === 0 ? (
                          <p className="text-xs text-[var(--app-text-muted)]">--</p>
                        ) : asrProvidersOpen ? (
                          <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                            {asrProviderUsage.map((item, index) => (
                              <div
                                key={`${item.provider}-${index}`}
                                className="rounded-xl border px-3 py-3 space-y-2"
                                style={{ borderColor: "var(--app-glass-border)" }}
                              >
                                <div className="flex items-center justify-between text-xs">
                                  <span
                                    className="text-[var(--app-text)] truncate max-w-[180px]"
                                    title={item.provider || "--"}
                                  >
                                    {providerLabel(item.provider || "--")}
                                  </span>
                                  <span className="text-[var(--app-text-muted)]">
                                    {t("stats.callCount", {
                                      count: getItemCallCount(item),
                                    })}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2 text-[11px] text-[var(--app-text-muted)]">
                                  <span className="rounded-full bg-[var(--app-success-bg)] px-2 py-0.5 text-[var(--app-success)]">
                                    {t("stats.successRate")} {formatPercentValue(getItemSuccessRate(item))}
                                  </span>
                                  <span className="rounded-full bg-[var(--app-danger-bg-soft)] px-2 py-0.5 text-[var(--app-danger-strong)]">
                                    {t("stats.failureRate")} {formatPercentValue(getItemFailureRate(item))}
                                  </span>
                                </div>
                                <div className="grid gap-1 text-[11px] text-[var(--app-text-muted)]">
                                  <div className="flex items-center justify-between">
                                    <span>{t("stats.avgStageSeconds")}</span>
                                    <span className="text-[var(--app-text)]">
                                      {formatSeconds(item.avg_stage_seconds)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span>{t("stats.medianStageSeconds")}</span>
                                    <span className="text-[var(--app-text)]">
                                      {formatSeconds(item.median_stage_seconds)}
                                    </span>
                                  </div>
                                  {Number.isFinite(item.total_audio_duration_seconds) &&
                                    (item.total_audio_duration_seconds ?? 0) > 0 && (
                                    <div className="flex items-center justify-between">
                                      <span>{t("stats.totalAudioDuration")}</span>
                                      <span className="text-[var(--app-text)]">
                                        {formatSeconds(item.total_audio_duration_seconds!)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                {(item.success_count ||
                                  item.failure_count ||
                                  item.processing_count ||
                                  item.pending_count) && (
                                  <p className="text-[11px] text-[var(--app-text-muted)]">
                                    {t("stats.statusCounts", {
                                      success: item.success_count || 0,
                                      failure: item.failure_count || 0,
                                      processing: item.processing_count || 0,
                                      pending: item.pending_count || 0,
                                    })}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div
                        className="rounded-2xl border p-4 space-y-3"
                        style={{ borderColor: "var(--app-glass-border)" }}
                      >
                        <button
                          type="button"
                          onClick={() => setLlmProvidersOpen((prev) => !prev)}
                          className="w-full flex items-center justify-between text-left"
                          aria-expanded={llmProvidersOpen}
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-[var(--app-text)]">
                              {t("stats.providerBreakdownLlm")}
                            </p>
                            <span className="text-xs text-[var(--app-text-muted)]">
                              {t("stats.callCount", { count: llmProviderTotal })}
                            </span>
                          </div>
                          {llmProvidersOpen ? (
                            <ChevronUp className="w-4 h-4 text-[var(--app-text-muted)]" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-[var(--app-text-muted)]" />
                          )}
                        </button>
                        {llmProviderUsage.length === 0 ? (
                          <p className="text-xs text-[var(--app-text-muted)]">--</p>
                        ) : llmProvidersOpen ? (
                          <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                            {llmProviderUsage.map((item, index) => (
                              <div
                                key={`${item.provider}-${index}`}
                                className="rounded-xl border px-3 py-3 space-y-2"
                                style={{ borderColor: "var(--app-glass-border)" }}
                              >
                                <div className="flex items-center justify-between text-xs">
                                  <span
                                    className="text-[var(--app-text)] truncate max-w-[180px]"
                                    title={item.provider || "--"}
                                  >
                                    {providerLabel(item.provider || "--")}
                                  </span>
                                  <span className="text-[var(--app-text-muted)]">
                                    {t("stats.callCount", {
                                      count: getItemCallCount(item),
                                    })}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2 text-[11px] text-[var(--app-text-muted)]">
                                  <span className="rounded-full bg-[var(--app-success-bg)] px-2 py-0.5 text-[var(--app-success)]">
                                    {t("stats.successRate")} {formatPercentValue(getItemSuccessRate(item))}
                                  </span>
                                  <span className="rounded-full bg-[var(--app-danger-bg-soft)] px-2 py-0.5 text-[var(--app-danger-strong)]">
                                    {t("stats.failureRate")} {formatPercentValue(getItemFailureRate(item))}
                                  </span>
                                </div>
                                <div className="grid gap-1 text-[11px] text-[var(--app-text-muted)]">
                                  <div className="flex items-center justify-between">
                                    <span>{t("stats.avgStageSeconds")}</span>
                                    <span className="text-[var(--app-text)]">
                                      {formatSeconds(item.avg_stage_seconds)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span>{t("stats.medianStageSeconds")}</span>
                                    <span className="text-[var(--app-text)]">
                                      {formatSeconds(item.median_stage_seconds)}
                                    </span>
                                  </div>
                                </div>
                                {(item.success_count ||
                                  item.failure_count ||
                                  item.processing_count ||
                                  item.pending_count) && (
                                  <p className="text-[11px] text-[var(--app-text-muted)]">
                                    {t("stats.statusCounts", {
                                      success: item.success_count || 0,
                                      failure: item.failure_count || 0,
                                      processing: item.processing_count || 0,
                                      pending: item.pending_count || 0,
                                    })}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-h3" style={{ color: "var(--app-text)" }}>
                    {t("stats.taskSection")}
                  </h3>
                  {loading && (
                    <span className="text-xs text-[var(--app-text-muted)]">
                      {t("common.loading")}...
                    </span>
                  )}
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="glass-panel rounded-2xl p-6 space-y-5">
                    <div>
                      <p className="text-xs text-[var(--app-text-muted)]">
                        {t("stats.totalTasks")}
                      </p>
                      <p className="text-2xl font-semibold text-[var(--app-text)]">
                        {taskOverview ? taskOverview.total_tasks : "--"}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {statusItems.map((item) => (
                        <div
                          key={item.key}
                          className="rounded-xl border px-3 py-2"
                          style={{ borderColor: "var(--app-glass-border)" }}
                        >
                          <p className="text-xs text-[var(--app-text-muted)]">
                            {item.label}
                          </p>
                          <p className="text-lg font-semibold text-[var(--app-text)]">
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2 text-xs text-[var(--app-text-muted)]">
                      <div className="flex items-center justify-between">
                        <span>{t("stats.successRate")}</span>
                        <span className="text-[var(--app-text)]">
                          {taskOverview
                            ? formatPercent(taskOverview.success_rate)
                            : "--"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{t("stats.failureRate")}</span>
                        <span className="text-[var(--app-text)]">
                          {taskOverview
                            ? formatPercent(taskOverview.failure_rate)
                            : "--"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel rounded-2xl p-6 space-y-4">
                    <p className="text-sm font-medium text-[var(--app-text)]">
                      {t("stats.processingSummary")}
                    </p>
                    <div className="space-y-2 text-xs text-[var(--app-text-muted)]">
                      <div className="flex items-center justify-between">
                        <span>{t("stats.avgProcessingTime")}</span>
                        <span className="text-[var(--app-text)]">
                          {taskOverview
                            ? formatSeconds(
                                taskOverview.avg_processing_time_seconds
                              )
                            : "--"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{t("stats.medianProcessingTime")}</span>
                        <span className="text-[var(--app-text)]">
                          {taskOverview
                            ? formatSeconds(
                                taskOverview.median_processing_time_seconds
                              )
                            : "--"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{t("stats.totalAudioDuration")}</span>
                        <span className="text-[var(--app-text)]">
                          {taskOverview
                            ? taskOverview.total_audio_duration_formatted
                            : "--"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <p className="text-xs text-[var(--app-text-muted)]">
                        {t("stats.processingByStage")}
                      </p>
                      {stageBreakdown.length === 0 ? (
                        <p className="text-xs text-[var(--app-text-muted)]">
                          --
                        </p>
                      ) : (
                        stageBreakdown.map((item, index) => (
                          <div
                            key={`${item.stage}-${index}`}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="text-[var(--app-text-muted)]">
                              {stageLabel(item.stage)}
                            </span>
                            <span className="text-[var(--app-text)]">
                              {formatSeconds(item.value)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
