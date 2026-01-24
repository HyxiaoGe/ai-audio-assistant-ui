"use client";

import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useI18n } from '@/lib/i18n-context';
import { useAPIClient } from '@/lib/use-api-client';
import { useDateFormatter } from '@/lib/use-date-formatter';
import { useUserStore } from '@/store/user-store';
import type { AsrAdminOverviewResponse } from '@/types/api';
import { ShieldAlert, TrendingUp, Clock, DollarSign, Zap } from 'lucide-react';

interface AdminProps {
  isAuthenticated?: boolean;
  onOpenLogin?: () => void;
  language?: 'zh' | 'en';
  onToggleLanguage?: () => void;
  onToggleTheme?: () => void;
}

export default function Admin({
  isAuthenticated = false,
  onOpenLogin = () => {},
  language = 'zh',
  onToggleLanguage = () => {},
  onToggleTheme = () => {}
}: AdminProps) {
  const { t } = useI18n();
  const client = useAPIClient();
  const { formatDateTime } = useDateFormatter();
  const isAdmin = useUserStore((state) => state.isAdmin);
  const profileLoaded = useUserStore((state) => state.profileLoaded);

  // ASR 概览状态
  const [asrOverview, setAsrOverview] = useState<AsrAdminOverviewResponse | null>(null);
  const [asrOverviewLoading, setAsrOverviewLoading] = useState(false);

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

  // 权限检查 - 等待 profile 加载完成
  if (!profileLoaded) {
    return (
      <div className="h-screen flex flex-col" style={{ background: "var(--app-bg)" }}>
        <Header
          isAuthenticated={isAuthenticated}
          onOpenLogin={onOpenLogin}
          language={language}
          onToggleLanguage={onToggleLanguage}
          onToggleTheme={onToggleTheme}
        />
        <div className="flex-1 flex overflow-hidden">
          <Sidebar />
          <main className="flex-1 flex items-center justify-center">
            <p className="text-[var(--app-text-muted)]">{t("common.loading")}...</p>
          </main>
        </div>
      </div>
    );
  }

  // 非管理员显示 403
  if (!isAdmin) {
    return (
      <div className="h-screen flex flex-col" style={{ background: "var(--app-bg)" }}>
        <Header
          isAuthenticated={isAuthenticated}
          onOpenLogin={onOpenLogin}
          language={language}
          onToggleLanguage={onToggleLanguage}
          onToggleTheme={onToggleTheme}
        />
        <div className="flex-1 flex overflow-hidden">
          <Sidebar />
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <ShieldAlert className="w-16 h-16 mx-auto" style={{ color: "var(--app-danger)" }} />
              <h2 className="text-xl font-semibold" style={{ color: "var(--app-text)" }}>
                {t("admin.accessDenied")}
              </h2>
              <p className="text-sm" style={{ color: "var(--app-text-muted)" }}>
                {t("admin.accessDeniedDesc")}
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--app-bg)" }}>
      <Header
        isAuthenticated={isAuthenticated}
        onOpenLogin={onOpenLogin}
        language={language}
        onToggleLanguage={onToggleLanguage}
        onToggleTheme={onToggleTheme}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto p-8">
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
          </div>
        </main>
      </div>
    </div>
  );
}
