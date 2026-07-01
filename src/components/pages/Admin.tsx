"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useI18n } from '@/lib/i18n-context';
import { useAPIClient } from '@/lib/use-api-client';
import { useDateFormatter } from '@/lib/use-date-formatter';
import { useUserStore } from '@/store/user-store';
import { formatMoney, isLlmUnavailable, formatUserName } from '@/lib/admin-cost-format';
import type { AdminCostsResponse, AsrAdminOverviewResponse } from '@/types/api';
import { ShieldAlert, TrendingUp, Clock, DollarSign, Zap, Users } from 'lucide-react';
import YouTubeBlocklistPanel from '@/components/admin/YouTubeBlocklistPanel';
import YouTubeAllowlistPanel from '@/components/admin/YouTubeAllowlistPanel';
import FlaggedChannelsReviewPanel from '@/components/admin/FlaggedChannelsReviewPanel';
import DiscoverFeatureToggle from '@/components/pages/admin/DiscoverFeatureToggle';

export default function Admin() {
  const { t } = useI18n();
  const client = useAPIClient();
  const { formatDateTime } = useDateFormatter();
  const isAdmin = useUserStore((state) => state.isAdmin);
  const profileLoaded = useUserStore((state) => state.profileLoaded);

  // ASR 概览状态
  const [asrOverview, setAsrOverview] = useState<AsrAdminOverviewResponse | null>(null);
  const [asrOverviewLoading, setAsrOverviewLoading] = useState(false);

  // 按用户成本状态
  const [costs, setCosts] = useState<AdminCostsResponse | null>(null);
  const [costsLoading, setCostsLoading] = useState(false);

  // 加载 ASR 概览
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    const loadOverview = async () => {
      setAsrOverviewLoading(true);
      try {
        const result = await client.getAsrAdminOverview();
        if (active) {
          setAsrOverview(result);
        }
      } catch {
        // 静默失败
      } finally {
        if (active) {
          setAsrOverviewLoading(false);
        }
      }
    };
    loadOverview();
    return () => {
      active = false;
    };
  }, [client, isAdmin]);

  // 加载按用户成本
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    const loadCosts = async () => {
      setCostsLoading(true);
      try {
        const result = await client.getCostsByUser();
        if (active) {
          setCosts(result);
        }
      } catch {
        // 静默失败
      } finally {
        if (active) {
          setCostsLoading(false);
        }
      }
    };
    loadCosts();
    return () => {
      active = false;
    };
  }, [client, isAdmin]);

  // 权限检查 - 等待 profile 加载完成
  if (!profileLoaded) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[var(--app-text-muted)]">{t("common.loading")}...</p>
      </div>
    );
  }

  // 非管理员显示 403
  if (!isAdmin) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <ShieldAlert className="w-16 h-16 mx-auto" style={{ color: "var(--app-danger)" }} />
          <h2 className="text-xl font-semibold" style={{ color: "var(--app-text)" }}>
            {t("admin.accessDenied")}
          </h2>
          <p className="text-sm" style={{ color: "var(--app-text-muted)" }}>
            {t("admin.accessDeniedDesc")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
            <h2 className="text-h2" style={{ color: "var(--app-text)" }}>
              {t("admin.title")}
            </h2>
          </div>

          <div className="space-y-6">
            {/* ASR 使用概览 */}
            <Card>
              <CardHeader>
                <CardTitle>{t("admin.overviewTitle")}</CardTitle>
                <CardDescription>
                  {t("admin.overviewDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {asrOverviewLoading && (
                  <p className="text-sm text-[var(--app-text-muted)]">{t("common.loading")}...</p>
                )}
                {!asrOverviewLoading && asrOverview && (
                  <>
                    {/* 汇总统计卡片 */}
                    <div className="rounded-xl border p-4" style={{ borderColor: "var(--app-glass-border)", background: "var(--app-glass-bg)" }}>
                      <h4 className="text-sm font-semibold mb-4" style={{ color: "var(--app-text)" }}>
                        {t("admin.summaryCard.title")}
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" style={{ color: "var(--app-primary)" }} />
                            <span className="text-xs text-[var(--app-text-muted)]">{t("admin.summaryCard.totalUsed")}</span>
                          </div>
                          <p className="text-lg font-semibold" style={{ color: "var(--app-text)" }}>
                            {asrOverview.summary.total_used_hours.toFixed(2)}h
                          </p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4" style={{ color: "var(--app-success)" }} />
                            <span className="text-xs text-[var(--app-text-muted)]">{t("admin.summaryCard.freeConsumed")}</span>
                          </div>
                          <p className="text-lg font-semibold" style={{ color: "var(--app-text)" }}>
                            {asrOverview.summary.total_free_hours.toFixed(2)}h
                          </p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" style={{ color: "var(--app-warning)" }} />
                            <span className="text-xs text-[var(--app-text-muted)]">{t("admin.summaryCard.paidSeconds")}</span>
                          </div>
                          <p className="text-lg font-semibold" style={{ color: "var(--app-text)" }}>
                            {asrOverview.summary.total_paid_hours.toFixed(2)}h
                          </p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4" style={{ color: "var(--app-danger)" }} />
                            <span className="text-xs text-[var(--app-text-muted)]">{t("admin.summaryCard.totalCost")}</span>
                          </div>
                          <p className="text-lg font-semibold" style={{ color: "var(--app-text)" }}>
                            ¥{asrOverview.summary.total_cost.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 免费额度状态 */}
                    {asrOverview.free_quota_status.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold" style={{ color: "var(--app-text)" }}>
                          {t("admin.freeQuotaStatus")}
                        </h4>
                        {asrOverview.free_quota_status.map((quota) => {
                          const resetPeriodLabel = quota.reset_period === "monthly"
                            ? t("admin.provider.resetMonthly")
                            : quota.reset_period === "yearly"
                            ? t("admin.provider.resetYearly")
                            : t("admin.provider.resetNone");
                          return (
                            <div
                              key={`${quota.provider}-${quota.variant}`}
                              className="rounded-xl border p-4 space-y-3"
                              style={{ borderColor: "var(--app-glass-border)", background: "var(--app-glass-bg)" }}
                            >
                              <div className="flex items-start justify-between">
                                <span className="font-semibold" style={{ color: "var(--app-text)" }}>
                                  {quota.display_name}
                                </span>
                                <span className="text-sm" style={{ color: "var(--app-text-muted)" }}>
                                  {resetPeriodLabel}
                                </span>
                              </div>

                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <p className="text-xs text-[var(--app-text-muted)]">{t("admin.provider.freeQuota")}</p>
                                  <p style={{ color: "var(--app-text)" }}>{quota.free_quota_hours.toFixed(1)}h</p>
                                </div>
                                <div>
                                  <p className="text-xs text-[var(--app-text-muted)]">{t("admin.provider.freeQuotaUsed")}</p>
                                  <p style={{ color: "var(--app-text)" }}>{quota.used_hours.toFixed(2)}h</p>
                                </div>
                                <div>
                                  <p className="text-xs text-[var(--app-text-muted)]">{t("admin.provider.freeQuotaRemaining")}</p>
                                  <p style={{ color: "var(--app-text)" }}>{quota.remaining_hours.toFixed(2)}h</p>
                                </div>
                              </div>

                              <Progress value={quota.usage_percent} />

                              {quota.period_start && quota.period_end && (
                                <p className="text-xs text-[var(--app-text-muted)]">
                                  {t("admin.provider.periodRange")}: {formatDateTime(quota.period_start, { year: "numeric", month: "2-digit", day: "2-digit" })} - {formatDateTime(quota.period_end, { year: "numeric", month: "2-digit", day: "2-digit" })}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* 提供商付费使用统计 */}
                    {asrOverview.providers_usage.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold" style={{ color: "var(--app-text)" }}>
                          {t("admin.providersUsage")}
                        </h4>
                        {asrOverview.providers_usage.map((provider) => (
                          <div
                            key={`${provider.provider}-${provider.variant}`}
                            className="rounded-xl border p-4 space-y-3"
                            style={{ borderColor: "var(--app-glass-border)", background: "var(--app-glass-bg)" }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold" style={{ color: "var(--app-text)" }}>
                                  {provider.display_name}
                                </span>
                                <span
                                  className="text-xs px-2 py-0.5 rounded-full"
                                  style={{
                                    background: provider.is_enabled ? "var(--app-success-soft)" : "var(--app-danger-soft)",
                                    color: provider.is_enabled ? "var(--app-success)" : "var(--app-danger)"
                                  }}
                                >
                                  {provider.is_enabled ? t("admin.provider.enabled") : t("admin.provider.disabled")}
                                </span>
                              </div>
                              <span className="text-sm font-medium" style={{ color: "var(--app-text-muted)" }}>
                                ¥{provider.cost_per_hour.toFixed(2)}/h
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-xs text-[var(--app-text-muted)]">{t("admin.provider.paidHours")}</p>
                                <p style={{ color: "var(--app-text)" }}>{provider.paid_hours.toFixed(2)}h</p>
                              </div>
                              <div>
                                <p className="text-xs text-[var(--app-text-muted)]">{t("admin.provider.paidCost")}</p>
                                <p style={{ color: "var(--app-text)" }}>¥{provider.paid_cost.toFixed(2)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {!asrOverviewLoading && !asrOverview && (
                  <p className="text-sm text-[var(--app-text-muted)]">{t("settings.asrQuotaEmpty")}</p>
                )}
              </CardContent>
            </Card>

            {/* 按用户成本（双币种：¥ ASR/配图 · $ LLM，绝不相加） */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-4 h-4" style={{ color: "var(--app-primary)" }} />
                  {t("admin.costByUser.title")}
                </CardTitle>
                <CardDescription>{t("admin.costByUser.desc")}</CardDescription>
              </CardHeader>
              <CardContent>
                {costsLoading && (
                  <p className="text-sm text-[var(--app-text-muted)]">{t("common.loading")}...</p>
                )}
                {!costsLoading && costs && costs.items.length === 0 && (
                  <p className="text-sm text-[var(--app-text-muted)]">{t("admin.costByUser.empty")}</p>
                )}
                {!costsLoading && costs && costs.items.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left" style={{ color: "var(--app-text-muted)" }}>
                          <th className="py-2 pr-4 font-medium">{t("admin.costByUser.user")}</th>
                          <th className="py-2 px-4 font-medium text-right">{t("admin.costByUser.asrCost")}</th>
                          <th className="py-2 px-4 font-medium text-right">{t("admin.costByUser.imageCost")}</th>
                          <th className="py-2 px-4 font-medium text-right">{t("admin.costByUser.cnyTotal")}</th>
                          <th className="py-2 pl-4 font-medium text-right">{t("admin.costByUser.llmCost")}</th>
                          <th className="py-2 pl-4 font-medium text-right">{t("admin.userTasks.viewTasks")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {costs.items.map((row) => {
                          const llmNa = isLlmUnavailable(row.llm_usd, costs.llm_source);
                          return (
                            <tr
                              key={row.user_id}
                              className="border-t"
                              style={{ borderColor: "var(--app-glass-border)" }}
                            >
                              <td className="py-2 pr-4" style={{ color: "var(--app-text)" }}>
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {formatUserName(row.display_name, {
                                      isSelf: row.is_self,
                                      fallback: t("admin.costByUser.anonymous"),
                                      selfSuffix: t("admin.costByUser.youSuffix"),
                                    })}
                                  </span>
                                  <span className="text-xs text-[var(--app-text-muted)]">
                                    {t("admin.costByUser.calls", { value: String(row.asr_calls) })}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2 px-4 text-right" style={{ color: "var(--app-text)" }}>
                                {formatMoney(row.asr_cny, "¥")}
                              </td>
                              <td className="py-2 px-4 text-right" style={{ color: "var(--app-text)" }}>
                                {formatMoney(row.image_cny, "¥")}
                              </td>
                              <td className="py-2 px-4 text-right font-semibold" style={{ color: "var(--app-text)" }}>
                                {formatMoney(row.cny_total, "¥")}
                              </td>
                              <td className="py-2 pl-4 text-right" style={{ color: "var(--app-text)" }}>
                                {llmNa ? (
                                  <span
                                    className="text-xs text-[var(--app-text-muted)]"
                                    title={t("admin.costByUser.llmUnavailableHint")}
                                  >
                                    {t("admin.costByUser.llmUnavailable")}
                                  </span>
                                ) : (
                                  formatMoney(row.llm_usd as number, "$")
                                )}
                              </td>
                              <td className="py-2 pl-4 text-right">
                                <Link
                                  href={`/admin/users/${row.user_id}/tasks`}
                                  className="text-[var(--app-primary)] hover:underline"
                                >
                                  {t("admin.userTasks.viewTasks")}
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 发现功能开关 */}
            <Card>
              <CardHeader>
                <CardTitle>{t("admin.discover.title")}</CardTitle>
                <CardDescription>{t("admin.discover.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <DiscoverFeatureToggle />
              </CardContent>
            </Card>

            {/* 搜索黑名单(屏蔽搜索词 + 博主) */}
            <YouTubeBlocklistPanel />

            {/* 搜索放行表(误杀频道恢复可搜) */}
            <YouTubeAllowlistPanel />

            {/* 频道标记复核队列 */}
            <FlaggedChannelsReviewPanel />
          </div>
    </div>
  );
}
