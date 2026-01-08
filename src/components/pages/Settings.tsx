"use client";

import { useEffect, useMemo, useState } from 'react';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSettings } from '@/lib/settings-context';
import { useI18n } from '@/lib/i18n-context';
import { notifyError, notifyInfo, notifySuccess } from '@/lib/notify';
import { useAPIClient } from '@/lib/use-api-client';
import { useDateFormatter } from '@/lib/use-date-formatter';
import type { AsrQuotaItem } from '@/types/api';
import { 
  Globe,
  Palette,
  Bell,
  Save,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';

interface SettingsProps {
  isAuthenticated?: boolean;
  onOpenLogin?: () => void;
  language?: 'zh' | 'en';
  onToggleLanguage?: () => void;
  onToggleTheme?: () => void;
}

type LocalSettings = {
  emailNotifications: boolean;
  pushNotifications: boolean;
  defaultLanguage: string;
  summaryDetail: string;
};

const DEFAULT_LOCAL_SETTINGS: LocalSettings = {
  emailNotifications: true,
  pushNotifications: false,
  defaultLanguage: "auto",
  summaryDetail: "medium",
};

const loadLocalSettings = (): LocalSettings => {
  if (typeof window === "undefined") return DEFAULT_LOCAL_SETTINGS;
  const saved = localStorage.getItem("settings");
  if (!saved) return DEFAULT_LOCAL_SETTINGS;
  try {
    const parsed = JSON.parse(saved) as Partial<LocalSettings> & {
      emailNotifications?: boolean;
      pushNotifications?: boolean;
      defaultLanguage?: string;
      summaryDetail?: string;
    };
    const normalizedDefaultLanguage =
      parsed.defaultLanguage === "zh-CN"
        ? "zh"
        : parsed.defaultLanguage === "en-US"
          ? "en"
          : parsed.defaultLanguage;
    return {
      emailNotifications:
        typeof parsed.emailNotifications === "boolean"
          ? parsed.emailNotifications
          : DEFAULT_LOCAL_SETTINGS.emailNotifications,
      pushNotifications:
        typeof parsed.pushNotifications === "boolean"
          ? parsed.pushNotifications
          : DEFAULT_LOCAL_SETTINGS.pushNotifications,
      defaultLanguage: normalizedDefaultLanguage || DEFAULT_LOCAL_SETTINGS.defaultLanguage,
      summaryDetail: parsed.summaryDetail || DEFAULT_LOCAL_SETTINGS.summaryDetail,
    };
  } catch {
    return DEFAULT_LOCAL_SETTINGS;
  }
};

export default function Settings({ 
  isAuthenticated = false, 
  onOpenLogin = () => {},
  language = 'zh',
  onToggleLanguage = () => {},
  onToggleTheme = () => {}
}: SettingsProps) {
  const {
    locale,
    theme: currentTheme,
    timeZone,
    hourCycle,
    setLocale,
    setTheme,
    setTimeZone,
    setHourCycle,
  } = useSettings();
  const [localSettings, setLocalSettings] = useState<LocalSettings>(() => loadLocalSettings());
  const [saved, setSaved] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"clearTasks" | "deleteAccount" | "resetSettings" | null>(null);
  const { t } = useI18n();
  const client = useAPIClient();
  const { formatDateTime } = useDateFormatter();
  const [asrQuotas, setAsrQuotas] = useState<AsrQuotaItem[]>([]);
  const [asrLoading, setAsrLoading] = useState(false);
  const [asrError, setAsrError] = useState<string | null>(null);
  const [asrSaving, setAsrSaving] = useState<Record<string, boolean>>({});
  const [editingQuotaKey, setEditingQuotaKey] = useState<string | null>(null);
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});
  const [quotaForm, setQuotaForm] = useState<{
    provider: string;
    window_type: AsrQuotaItem["window_type"];
    quota_hours: number;
    used_hours: number;
    reset: boolean;
    window_start?: string;
    window_end?: string;
  } | null>(null);

  const languageState = locale;
  const themeState = currentTheme;
  const timeZoneState = timeZone;
  const hourCycleState = hourCycle;
  const {
    emailNotifications,
    pushNotifications,
    defaultLanguage: defaultLanguageState,
    summaryDetail: summaryDetailState,
  } = localSettings;

  const formatHours = (hours: number) => {
    return `${hours.toFixed(2)}h`;
  };

  const DEFAULT_TOTAL_START = "1970-01-01";
  const DEFAULT_TOTAL_END = "2099-12-31";

  const toDateInput = (value?: string) => {
    if (!value) return "";
    return value.slice(0, 10);
  };

  const normalizeDateInput = (value?: string, fallback?: string) => {
    const normalized = toDateInput(value);
    return normalized || fallback || "";
  };

  const toIsoDate = (value?: string, isEnd = false) => {
    if (!value) return undefined;
    return isEnd ? `${value}T23:59:59Z` : `${value}T00:00:00Z`;
  };

  const formatWindow = (start: string, end: string) => {
    const startLabel = formatDateTime(start, { year: "numeric", month: "2-digit", day: "2-digit" });
    const endLabel = formatDateTime(end, { year: "numeric", month: "2-digit", day: "2-digit" });
    return `${startLabel} - ${endLabel}`;
  };

  const windowTypeLabel = (type: AsrQuotaItem["window_type"]) => {
    const key = `settings.asrQuotaWindow.${type}`;
    const label = t(key);
    return label === key ? type : label;
  };

  const statusLabel = (status: AsrQuotaItem["status"]) => {
    const key = `settings.asrQuotaStatus.${status}`;
    const label = t(key);
    return label === key ? status : label;
  };

  const providerLabel = (provider: string) => {
    const key = `settings.asrQuotaProvider.${provider}`;
    const label = t(key);
    return label === key ? provider : label;
  };

  const groupedAsrQuotas = useMemo(() => {
    const order = new Map<AsrQuotaItem["window_type"], number>([
      ["day", 0],
      ["month", 1],
      ["total", 2],
      ["week", 3],
      ["year", 4],
    ]);
    const grouped = new Map<string, AsrQuotaItem[]>();
    asrQuotas.forEach((item) => {
      const list = grouped.get(item.provider) || [];
      list.push(item);
      grouped.set(item.provider, list);
    });
    return Array.from(grouped.entries())
      .map(([provider, items]) => ({
        provider,
        items: [...items].sort((a, b) => {
          const aOrder = order.get(a.window_type) ?? 99;
          const bOrder = order.get(b.window_type) ?? 99;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return a.window_type.localeCompare(b.window_type);
        }),
      }))
      .sort((a, b) => a.provider.localeCompare(b.provider));
  }, [asrQuotas]);

  const toggleProvider = (provider: string) => {
    setExpandedProviders((prev) => ({
      ...prev,
      [provider]: !prev[provider],
    }));
  };

  useEffect(() => {
    let active = true;
    const loadQuotas = async () => {
      setAsrLoading(true);
      setAsrError(null);
      try {
        const result = await client.getAsrQuotas();
        if (active) {
          setAsrQuotas(result.items || []);
        }
      } catch (error) {
        if (!active) return;
        setAsrError(t("settings.asrQuotaLoadFailed"));
      } finally {
        if (active) {
          setAsrLoading(false);
        }
      }
    };
    loadQuotas();
    return () => {
      active = false;
    };
  }, [client, t]);

  const canEditWindowType = (type: AsrQuotaItem["window_type"]) => {
    return type === "day" || type === "month" || type === "total";
  };

  const startEditQuota = (item: AsrQuotaItem) => {
    const key = `${item.provider}-${item.window_type}`;
    setEditingQuotaKey(key);
    const isTotal = item.window_type === "total";
    setQuotaForm({
      provider: item.provider,
      window_type: canEditWindowType(item.window_type) ? item.window_type : "month",
      quota_hours: item.quota_seconds,
      used_hours: item.used_seconds,
      reset: true,
      window_start: isTotal
        ? normalizeDateInput(item.window_start, DEFAULT_TOTAL_START)
        : normalizeDateInput(item.window_start),
      window_end: isTotal
        ? normalizeDateInput(item.window_end, DEFAULT_TOTAL_END)
        : normalizeDateInput(item.window_end),
    });
  };

  const cancelEditQuota = () => {
    setEditingQuotaKey(null);
    setQuotaForm(null);
  };

  const handleSaveQuota = async (item: AsrQuotaItem) => {
    if (!quotaForm) return;
    const key = `${item.provider}-${item.window_type}`;
    setAsrSaving((prev) => ({ ...prev, [key]: true }));
    try {
      const hasTotalWindow = quotaForm.window_type === "total";
      const result = await client.refreshAsrQuota({
        provider: quotaForm.provider,
        window_type: quotaForm.window_type,
        quota_seconds: Math.max(0, quotaForm.quota_hours),
        used_seconds: Math.max(0, quotaForm.used_hours),
        reset: quotaForm.reset,
        window_start: hasTotalWindow ? toIsoDate(quotaForm.window_start) : undefined,
        window_end: hasTotalWindow ? toIsoDate(quotaForm.window_end, true) : undefined,
      });
      setAsrQuotas((prev) =>
        prev.map((quota) =>
          quota.provider === item.provider && quota.window_type === item.window_type
            ? result.item
            : quota
        )
      );
      notifySuccess(t("settings.asrQuotaRefreshSuccess"));
      cancelEditQuota();
    } catch {
      notifyError(t("settings.asrQuotaRefreshFailed"));
    } finally {
      setAsrSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  const persistLocalSettings = (partial: Record<string, unknown>) => {
    const saved = localStorage.getItem("settings");
    const current = saved ? JSON.parse(saved) : {};
    localStorage.setItem("settings", JSON.stringify({ ...current, ...partial }));
  };

  const openConfirm = (action: "clearTasks" | "deleteAccount" | "resetSettings") => {
    setConfirmAction(action);
    setConfirmOpen(true);
  };

  const resetAllSettings = () => {
    localStorage.removeItem("settings");
    setLocalSettings(DEFAULT_LOCAL_SETTINGS);
    setLocale("zh-CN");
    setTheme("system");
    setTimeZone("auto");
    setHourCycle("auto");
    notifyInfo(t("settings.resetSuccess"), { persist: false });
  };

  const handleConfirm = () => {
    if (!confirmAction) return;
    if (confirmAction === "resetSettings") {
      resetAllSettings();
    } else if (confirmAction === "clearTasks") {
      notifyInfo(t("settings.clearTasksSuccess"), { persist: false });
    } else if (confirmAction === "deleteAccount") {
      notifyInfo(t("settings.deleteAccountSuccess"), { persist: false });
    }
    setConfirmOpen(false);
    setConfirmAction(null);
  };

  const handleLanguageChange = (value: string) => {
    setLocale(value);
    notifyInfo(
      value.toLowerCase().startsWith("zh")
        ? t("settings.languageSwitchedZh")
        : t("settings.languageSwitchedEn"),
      { persist: false }
    );
  };

  const handleThemeChange = (value: string) => {
    setTheme(value as "light" | "dark" | "system");
    notifyInfo(
      value === "dark"
        ? t("settings.themeSwitchedDark")
        : value === "light"
          ? t("settings.themeSwitchedLight")
          : t("settings.themeSwitchedSystem"),
      { persist: false }
    );
  };

  const handleTimeZoneChange = (value: string) => {
    setTimeZone(value);
    notifyInfo(
      value === "auto"
        ? t("settings.timeZoneAutoSelected")
        : t("settings.timeZoneSelected", { value }),
      { persist: false }
    );
  };

  const handleHourCycleChange = (value: string) => {
    setHourCycle(value as "auto" | "h12" | "h23");
    notifyInfo(
      value === "auto"
        ? t("settings.timeFormatAutoSelected")
        : value === "h23"
          ? t("settings.timeFormat24Selected")
          : t("settings.timeFormat12Selected"),
      { persist: false }
    );
  };

  const handleDefaultLanguageChange = (value: string) => {
    setLocalSettings((prev) => ({ ...prev, defaultLanguage: value }));
    persistLocalSettings({ defaultLanguage: value });
    const label =
      value === "auto"
        ? t("task.languageAuto")
        : value === "zh"
          ? t("task.languageZh")
          : t("task.languageEn");
    notifyInfo(t("settings.processingLanguageSelected", { value: label }), {
      persist: false,
    });
  };

  const handleSummaryDetailChange = (value: string) => {
    setLocalSettings((prev) => ({ ...prev, summaryDetail: value }));
    persistLocalSettings({ summaryDetail: value });
    const label =
      value === "brief"
        ? t("settings.summaryBrief")
        : value === "detailed"
          ? t("settings.summaryDetailed")
          : t("settings.summaryMedium");
    notifyInfo(t("settings.summaryDetailSelected", { value: label }), {
      persist: false,
    });
  };

  const handleEmailToggle = (checked: boolean) => {
    setLocalSettings((prev) => ({ ...prev, emailNotifications: checked }));
    persistLocalSettings({ emailNotifications: checked });
    notifyInfo(
      checked ? t("settings.emailNotificationsEnabled") : t("settings.emailNotificationsDisabled"),
      { persist: false }
    );
  };

  const handlePushToggle = (checked: boolean) => {
    setLocalSettings((prev) => ({ ...prev, pushNotifications: checked }));
    persistLocalSettings({ pushNotifications: checked });
    notifyInfo(
      checked ? t("settings.pushNotificationsEnabled") : t("settings.pushNotificationsDisabled"),
      { persist: false }
    );
  };

  const handleSave = () => {
    // 保存设置到localStorage
    localStorage.setItem('settings', JSON.stringify({
      language: languageState,
      theme: themeState,
      timeZone: timeZoneState,
      hourCycle: hourCycleState,
      emailNotifications,
      pushNotifications,
      defaultLanguage: defaultLanguageState,
      summaryDetail: summaryDetailState
    }));
    setLocale(languageState);
    setTheme(themeState as "light" | "dark" | "system");
    setTimeZone(timeZoneState);
    setHourCycle(hourCycleState as "auto" | "h12" | "h23");
    
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--app-bg)" }}>
      {/* Header */}
      <Header 
        isAuthenticated={isAuthenticated} 
        onOpenLogin={onOpenLogin}
        language={language}
        onToggleLanguage={onToggleLanguage}
        onToggleTheme={onToggleTheme}
      />

      {/* 主体：Sidebar + 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto p-8">
          {/* 页面标题和保存按钮 */}
          <div className="flex items-center justify-between mb-8">
            <h2 
              className="text-h2"
              style={{ color: "var(--app-text)" }}
            >
              {t("settings.title")}
            </h2>
            <Button
              onClick={handleSave}
              disabled={saved}
              style={{
                background: saved
                  ? "var(--app-success)"
                  : "var(--app-action-gradient)"
              }}
              className="text-white hover:opacity-90 transition-opacity"
            >
              {saved ? (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  {t("common.saved")}
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  {t("settings.saveAction")}
                </>
              )}
            </Button>
          </div>

          {/* 设置卡片 */}
          <div className="space-y-6">
            {/* Language & Theme Settings */}
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.appearanceTitle")}</CardTitle>
                <CardDescription>
                  {t("settings.appearanceDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    {t("settings.languageLabel")}
                  </Label>
                  <Select value={languageState} onValueChange={handleLanguageChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zh-CN">{t("settings.languageZh")}</SelectItem>
                      <SelectItem value="en-US">{t("settings.languageEn")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-[var(--app-text-muted)]">
                    {t("settings.languageDesc")}
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    {t("settings.timeTitle")}
                  </Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Select value={timeZoneState} onValueChange={handleTimeZoneChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("settings.timeZonePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">{t("settings.timeZoneAuto")}</SelectItem>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="Asia/Shanghai">Asia/Shanghai</SelectItem>
                        <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                        <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                        <SelectItem value="America/New_York">America/New_York</SelectItem>
                        <SelectItem value="Europe/London">Europe/London</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={hourCycleState} onValueChange={handleHourCycleChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("settings.timeFormatPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">{t("settings.timeFormatAuto")}</SelectItem>
                        <SelectItem value="h23">{t("settings.timeFormat24")}</SelectItem>
                        <SelectItem value="h12">{t("settings.timeFormat12")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-sm text-[var(--app-text-muted)]">
                    {t("settings.timeDesc")}
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    {t("settings.themeLabel")}
                  </Label>
                  <Select value={themeState} onValueChange={handleThemeChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                    <SelectContent>
                  <SelectItem value="light">{t("settings.themeLight")}</SelectItem>
                  <SelectItem value="dark">{t("settings.themeDark")}</SelectItem>
                  <SelectItem value="system">{t("settings.themeAuto")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-[var(--app-text-muted)]">
                {t("settings.themeDesc")}
              </p>
            </div>
              </CardContent>
            </Card>
            {/* Notification Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  {t("settings.notificationsTitle")}
                </CardTitle>
                <CardDescription>
                  {t("settings.notificationsDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="email-notifications">{t("settings.emailNotifications")}</Label>
                    <p className="text-sm text-[var(--app-text-muted)]">
                      {t("settings.emailNotificationsDesc")}
                    </p>
                  </div>
                  <Switch
                    id="email-notifications"
                    checked={emailNotifications}
                    onCheckedChange={handleEmailToggle}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="push-notifications">{t("settings.pushNotifications")}</Label>
                    <p className="text-sm text-[var(--app-text-muted)]">
                      {t("settings.pushNotificationsDesc")}
                    </p>
                  </div>
                  <Switch
                    id="push-notifications"
                    checked={pushNotifications}
                    onCheckedChange={handlePushToggle}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Processing Settings */}
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.processingTitle")}</CardTitle>
                <CardDescription>
                  {t("settings.processingDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>{t("settings.defaultLanguage")}</Label>
                  <Select value={defaultLanguageState} onValueChange={handleDefaultLanguageChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">{t("task.languageAuto")}</SelectItem>
                      <SelectItem value="zh">{t("task.languageZh")}</SelectItem>
                      <SelectItem value="en">{t("task.languageEn")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-[var(--app-text-muted)]">
                    {t("settings.defaultLanguageDesc")}
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>{t("settings.summaryDetail")}</Label>
                  <Select value={summaryDetailState} onValueChange={handleSummaryDetailChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="brief">{t("settings.summaryBrief")}</SelectItem>
                      <SelectItem value="medium">{t("settings.summaryMedium")}</SelectItem>
                      <SelectItem value="detailed">{t("settings.summaryDetailed")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-[var(--app-text-muted)]">
                    {t("settings.summaryDetailDesc")}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* ASR Quotas */}
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.asrQuotaTitle")}</CardTitle>
                <CardDescription>
                  {t("settings.asrQuotaDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {asrLoading && (
                  <p className="text-sm text-[var(--app-text-muted)]">{t("common.loading")}...</p>
                )}
                {!asrLoading && asrError && (
                  <p className="text-sm text-[var(--app-danger)]">{asrError}</p>
                )}
                {!asrLoading && !asrError && groupedAsrQuotas.length === 0 && (
                  <p className="text-sm text-[var(--app-text-muted)]">{t("settings.asrQuotaEmpty")}</p>
                )}
                {!asrLoading && !asrError && groupedAsrQuotas.length > 0 && (
                  <div className="space-y-4">
                    {groupedAsrQuotas.map((group) => (
                      <div key={group.provider} className="space-y-3">
                        <button
                          type="button"
                          onClick={() => toggleProvider(group.provider)}
                          className="w-full flex items-center justify-between rounded-lg px-3 py-2 border text-sm font-semibold"
                          style={{ borderColor: "var(--app-glass-border)", color: "var(--app-text)" }}
                        >
                          <div className="flex items-center gap-2">
                            <ChevronRight
                              className={`w-4 h-4 transition-transform ${expandedProviders[group.provider] ? "rotate-90" : ""}`}
                              style={{ color: "var(--app-text-muted)" }}
                            />
                            <span>{providerLabel(group.provider)}</span>
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--app-glass-bg-strong)", color: "var(--app-text-muted)" }}>
                            {group.items.length}
                          </span>
                        </button>
                        {expandedProviders[group.provider] && (
                          <div className="space-y-3">
                            {group.items.map((item) => {
                            const key = `${item.provider}-${item.window_type}`;
                            const isEditing = editingQuotaKey === key;
                            const isEditable = canEditWindowType(item.window_type);
                            const percent = item.quota_seconds
                              ? Math.min(100, Math.round((item.used_seconds / item.quota_seconds) * 100))
                              : 0;
                            return (
                              <div
                                key={key}
                                className="rounded-xl border p-4 space-y-3"
                                style={{ borderColor: "var(--app-glass-border)" }}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--app-primary-soft-2)", color: "var(--app-primary)" }}>
                                        {windowTypeLabel(item.window_type)}
                                      </span>
                                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--app-glass-bg-strong)", color: "var(--app-text-muted)" }}>
                                        {statusLabel(item.status)}
                                      </span>
                                    </div>
                                    <p className="text-xs text-[var(--app-text-muted)]">
                                      {formatWindow(item.window_start, item.window_end)}
                                    </p>
                                  </div>
                                  {!isEditing && (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => startEditQuota(item)}
                                      disabled={!isEditable}
                                    >
                                      {t("settings.asrQuotaEdit")}
                                    </Button>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-xs text-[var(--app-text-muted)]">
                                    <span>{t("settings.asrQuotaUsed", { used: formatHours(item.used_seconds) })}</span>
                                    <span>{t("settings.asrQuotaTotal", { total: formatHours(item.quota_seconds) })}</span>
                                  </div>
                                  <Progress value={percent} />
                                </div>

                                {isEditing && quotaForm && (
                                  <div className="mt-2 space-y-4 rounded-lg border p-3" style={{ borderColor: "var(--app-glass-border)" }}>
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-1">
                                      <Label className="text-xs">{t("settings.asrQuotaWindowLabel")}</Label>
                                      <Select
                                        value={quotaForm.window_type}
                                        onValueChange={(value) =>
                                          setQuotaForm((prev) =>
                                            prev
                                              ? {
                                                  ...prev,
                                                  window_type: value as AsrQuotaItem["window_type"],
                                                  window_start:
                                                    value === "total"
                                                      ? normalizeDateInput(prev.window_start, DEFAULT_TOTAL_START)
                                                      : prev.window_start,
                                                  window_end:
                                                    value === "total"
                                                      ? normalizeDateInput(prev.window_end, DEFAULT_TOTAL_END)
                                                      : prev.window_end,
                                                }
                                              : prev
                                          )
                                        }
                                      >
                                        <SelectTrigger className="w-full">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="day">{windowTypeLabel("day")}</SelectItem>
                                          <SelectItem value="month">{windowTypeLabel("month")}</SelectItem>
                                          <SelectItem value="total">{windowTypeLabel("total")}</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">{t("settings.asrQuotaHoursLabel")}</Label>
                                        <input
                                          type="number"
                                          min={0}
                                          step="0.1"
                                          className="glass-control h-9 w-full rounded-md px-3 text-sm"
                                          value={quotaForm.quota_hours}
                                          onChange={(e) =>
                                            setQuotaForm((prev) =>
                                            prev
                                              ? {
                                                  ...prev,
                                                  quota_hours: Number(e.target.value),
                                                }
                                              : prev
                                          )
                                        }
                                      />
                                    </div>
                                  </div>

                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-1">
                                      <Label className="text-xs">{t("settings.asrQuotaUsedHoursLabel")}</Label>
                                      <input
                                        type="number"
                                        min={0}
                                        step="0.1"
                                        className="glass-control h-9 w-full rounded-md px-3 text-sm"
                                        value={quotaForm.used_hours}
                                        onChange={(e) =>
                                          setQuotaForm((prev) =>
                                            prev
                                              ? {
                                                  ...prev,
                                                  used_hours: Number(e.target.value),
                                                }
                                              : prev
                                          )
                                        }
                                      />
                                    </div>
                                  </div>

                                  {quotaForm.window_type === "total" && (
                                    <div className="grid gap-3 sm:grid-cols-2">
                                      <div className="space-y-1">
                                        <Label className="text-xs">{t("settings.asrQuotaWindowStart")}</Label>
                                        <input
                                          type="date"
                                          className="glass-control h-9 w-full rounded-md px-3 text-sm"
                                          value={toDateInput(quotaForm.window_start)}
                                          onChange={(e) =>
                                            setQuotaForm((prev) =>
                                              prev
                                                ? {
                                                    ...prev,
                                                    window_start: e.target.value,
                                                  }
                                                : prev
                                            )
                                          }
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">{t("settings.asrQuotaWindowEnd")}</Label>
                                        <input
                                          type="date"
                                          className="glass-control h-9 w-full rounded-md px-3 text-sm"
                                          value={toDateInput(quotaForm.window_end)}
                                          onChange={(e) =>
                                            setQuotaForm((prev) =>
                                              prev
                                                ? {
                                                    ...prev,
                                                    window_end: e.target.value,
                                                  }
                                                : prev
                                            )
                                          }
                                        />
                                      </div>
                                    </div>
                                  )}

                                    <div className="flex items-center justify-between">
                                      <div className="space-y-1">
                                        <Label className="text-xs">{t("settings.asrQuotaResetLabel")}</Label>
                                        <p className="text-xs text-[var(--app-text-muted)]">
                                          {t("settings.asrQuotaResetDesc")}
                                        </p>
                                      </div>
                                      <Switch
                                        checked={quotaForm.reset}
                                        onCheckedChange={(checked) =>
                                          setQuotaForm((prev) =>
                                            prev ? { ...prev, reset: checked } : prev
                                          )
                                        }
                                      />
                                    </div>

                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={cancelEditQuota}
                                      >
                                        {t("settings.asrQuotaCancel")}
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => handleSaveQuota(item)}
                                        disabled={asrSaving[key]}
                                      >
                                        {asrSaving[key]
                                          ? t("settings.asrQuotaSaving")
                                          : t("settings.asrQuotaSave")}
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Account Info */}
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.accountTitle")}</CardTitle>
                <CardDescription>
                  {t("settings.accountDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-[var(--app-text-muted)]">{t("settings.statsTotalTasks")}</p>
                    <p className="text-2xl font-semibold">24</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-[var(--app-text-muted)]">{t("settings.statsMonthly")}</p>
                    <p className="text-2xl font-semibold">8</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-[var(--app-text-muted)]">{t("settings.statsDuration")}</p>
                    <p className="text-2xl font-semibold">12.5h</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-[var(--app-text-muted)]">{t("settings.statsStorage")}</p>
                    <p className="text-2xl font-semibold">2.3GB</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-[var(--app-danger-border)]">
              <CardHeader>
                <CardTitle className="text-[var(--app-danger)]">{t("settings.dangerTitle")}</CardTitle>
                <CardDescription>
                  {t("settings.dangerDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.resetSettings")}</p>
                    <p className="text-sm text-[var(--app-text-muted)]">{t("settings.resetSettingsDesc")}</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openConfirm("resetSettings")}
                  >
                    {t("settings.resetSettingsAction")}
                  </Button>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.clearTasks")}</p>
                    <p className="text-sm text-[var(--app-text-muted)]">{t("settings.clearTasksDesc")}</p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => openConfirm("clearTasks")}
                  >
                    {t("settings.clearTasksAction")}
                  </Button>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("settings.deleteAccount")}</p>
                    <p className="text-sm text-[var(--app-text-muted)]">{t("settings.deleteAccountDesc")}</p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => openConfirm("deleteAccount")}
                  >
                    {t("settings.deleteAccount")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "clearTasks"
                ? t("settings.clearTasksConfirmTitle")
                : confirmAction === "deleteAccount"
                  ? t("settings.deleteAccountConfirmTitle")
                  : t("settings.resetSettingsConfirmTitle")}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "clearTasks"
                ? t("settings.clearTasksConfirmDesc")
                : confirmAction === "deleteAccount"
                  ? t("settings.deleteAccountConfirmDesc")
                  : t("settings.resetSettingsConfirmDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setConfirmOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleConfirm}>
              {t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
