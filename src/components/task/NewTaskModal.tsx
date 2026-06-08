"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { notifyError, notifySuccess } from '@/lib/notify';
import { X, Link as LinkIcon, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import TabSwitch from './TabSwitch';
import UploadZone from './UploadZone';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { SummaryModelSelect } from './SummaryModelSelect';
import { useAPIClient } from '@/lib/use-api-client';
import { useFileUpload } from '@/hooks/use-file-upload';
import type {
  LLMModel,
  SummaryStyleItem,
  TaskOptions,
  UserPreferences,
  YouTubeSummaryStyleRecommendation,
} from '@/types/api';
import { useI18n } from '@/lib/i18n-context';

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-fill with a YouTube video URL */
  initialVideoUrl?: string;
  /** Prefer this cached YouTube video id for subscription-triggered transcription */
  initialYouTubeVideoId?: string;
}

type Platform = 'youtube' | 'bilibili';

const getStoredDefaultLanguage = () => {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("settings");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { defaultLanguage?: string };
    if (parsed.defaultLanguage === "auto" || parsed.defaultLanguage === "zh" || parsed.defaultLanguage === "en") {
      return parsed.defaultLanguage;
    }
  } catch {
    // ignore localStorage parse errors
  }
  return null;
};


const resolvePreferredModel = (preferences: UserPreferences, models: LLMModel[]) => {
  const preferredId =
    preferences.task_defaults?.llm_model_id || preferences.task_defaults?.llm_provider;
  if (!preferredId) return null;
  const match = models.find((model) =>
    model.model_id ? model.model_id === preferredId : model.provider === preferredId
  );
  return match ? (match.model_id || match.provider) : null;
};

const extractYouTubeVideoId = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      return parsed.pathname.split("/").filter(Boolean)[0] || null;
    }
    if (host.endsWith("youtube.com")) {
      const watchId = parsed.searchParams.get("v");
      if (watchId) return watchId;
      const parts = parsed.pathname.split("/").filter(Boolean);
      if ((parts[0] === "shorts" || parts[0] === "embed") && parts[1]) {
        return parts[1];
      }
    }
  } catch {
    return null;
  }
  return null;
};

export default function NewTaskModal({
  isOpen,
  onClose,
  initialVideoUrl,
  initialYouTubeVideoId,
}: NewTaskModalProps) {
  const router = useRouter();
  const client = useAPIClient();
  const { state: uploadState, uploadFile, reset, isUploading } = useFileUpload();
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('youtube');
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [advancedOptions, setAdvancedOptions] = useState({
    summaryModelId: null as string | null,
    language: 'auto',
    speakerDiarization: false,
    summaryStyle: 'auto'
  });
  const [llmModels, setLlmModels] = useState<LLMModel[]>([]);
  const [summaryStyles, setSummaryStyles] = useState<SummaryStyleItem[]>([]);
  const [styleRecommendation, setStyleRecommendation] =
    useState<YouTubeSummaryStyleRecommendation | null>(null);
  const [styleRecommendationLoading, setStyleRecommendationLoading] = useState(false);
  const preferencesRef = useRef<UserPreferences | null>(null);
  const advancedTouchedRef = useRef(false);
  const summaryStyleTouchedRef = useRef(false);
  const summaryStyleRecommendedRef = useRef(false);
  const recommendationRequestRef = useRef<string | null>(null);
  const recommendationInFlightRef = useRef<string | null>(null);
  const modalOpenRef = useRef(false);

  const tabs = [
    { id: 'upload', label: t("newTask.tabs.upload") },
    { id: 'link', label: t("newTask.tabs.link") }
  ];

  const platformTabs = [
    { id: 'youtube', label: 'YouTube' },
    { id: 'bilibili', label: 'Bilibili' }
  ];

  const platformInfo = {
    youtube: {
      placeholder: 'https://youtube.com/watch?v=...',
      formats: [
        'youtube.com/watch?v=xxx',
        'youtu.be/xxx'
      ]
    },
    bilibili: {
      placeholder: 'https://www.bilibili.com/video/BVxxx...',
      formats: [
        'bilibili.com/video/BVxxx',
        'b23.tv/xxx'
      ]
    }
  };

  const handleFileSelect = (file: File) => {
    reset();
    setSelectedFile(file);
  };

  const handleFileRemove = () => {
    reset();
    setSelectedFile(null);
  };

  // Handle initial video URL
  useEffect(() => {
    if (isOpen && initialVideoUrl) {
      setActiveTab('link');
      setVideoUrl(initialVideoUrl);
      // Auto-detect platform from URL
      if (initialVideoUrl.includes('bilibili.com') || initialVideoUrl.includes('b23.tv')) {
        setSelectedPlatform('bilibili');
      } else {
        setSelectedPlatform('youtube');
      }
    }
  }, [isOpen, initialVideoUrl]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const loadData = async () => {
      // Load LLM models and summary styles in parallel
      try {
        const [modelsResult, stylesResult] = await Promise.all([
          client.getLLMModels().catch(() => ({ models: [] })),
          client.getSummaryStyles().catch(() => ({ styles: [] })),
        ]);
        if (active) {
          setLlmModels(modelsResult.models || []);
          setSummaryStyles(stylesResult.styles || []);
        }
      } catch {
        if (active) {
          setLlmModels([]);
          setSummaryStyles([]);
        }
      }
    };
    loadData();
    return () => {
      active = false;
    };
  }, [client, isOpen, locale]);

  const applyPreferenceDefaults = useCallback((preferences: UserPreferences) => {
    if (advancedTouchedRef.current) return;
    const defaults = preferences.task_defaults || {};
    const preferredModelId = resolvePreferredModel(preferences, llmModels);
    const fallbackLanguage = getStoredDefaultLanguage();

    setAdvancedOptions((prev) => {
      const keepCurrentSummaryStyle =
        summaryStyleTouchedRef.current || summaryStyleRecommendedRef.current;
      return {
        ...prev,
        language: defaults.language || fallbackLanguage || prev.language,
        speakerDiarization:
          typeof defaults.enable_speaker_diarization === "boolean"
            ? defaults.enable_speaker_diarization
            : prev.speakerDiarization,
        summaryStyle: keepCurrentSummaryStyle
          ? prev.summaryStyle
          : defaults.summary_style || prev.summaryStyle,
        summaryModelId: preferredModelId ?? null,
      };
    });
  }, [llmModels]);

  useEffect(() => {
    if (!isOpen) {
      modalOpenRef.current = false;
      return;
    }
    if (!modalOpenRef.current) {
      modalOpenRef.current = true;
      advancedTouchedRef.current = false;
      summaryStyleTouchedRef.current = false;
      summaryStyleRecommendedRef.current = false;
      const fallbackLanguage = getStoredDefaultLanguage();
      if (fallbackLanguage) {
        setAdvancedOptions((prev) => ({
          ...prev,
          language: fallbackLanguage,
        }));
      }
    }
    let active = true;
    const loadPreferences = async () => {
      try {
        const preferences = await client.getUserPreferences();
        if (!active) return;
        preferencesRef.current = preferences;
        applyPreferenceDefaults(preferences);
      } catch {
        // ignore preference load failures
      }
    };
    loadPreferences();
    return () => {
      active = false;
    };
  }, [applyPreferenceDefaults, client, isOpen]);

  useEffect(() => {
    if (!isOpen || !preferencesRef.current) return;
    applyPreferenceDefaults(preferencesRef.current);
  }, [applyPreferenceDefaults, isOpen, llmModels]);

  useEffect(() => {
    if (!isOpen || activeTab !== "link" || selectedPlatform !== "youtube") return;
    const inputVideoId = extractYouTubeVideoId(videoUrl.trim());
    const initialUrlVideoId = initialVideoUrl ? extractYouTubeVideoId(initialVideoUrl) : null;
    const videoId =
      inputVideoId && inputVideoId === initialUrlVideoId
        ? initialYouTubeVideoId || inputVideoId
        : inputVideoId;
    if (!videoId) {
      setStyleRecommendation(null);
      setStyleRecommendationLoading(false);
      summaryStyleRecommendedRef.current = false;
      recommendationRequestRef.current = null;
      return;
    }
    if (
      recommendationInFlightRef.current === videoId ||
      (recommendationRequestRef.current === videoId && styleRecommendation?.style)
    ) {
      return;
    }

    let active = true;
    recommendationRequestRef.current = videoId;
    recommendationInFlightRef.current = videoId;
    setStyleRecommendation(null);
    setStyleRecommendationLoading(true);

    client
      .getYouTubeSummaryStyleRecommendation(videoId)
      .then((recommendation) => {
        if (!active || recommendationRequestRef.current !== videoId) return;
        setStyleRecommendation(recommendation);
        if (!summaryStyleTouchedRef.current && recommendation.style) {
          summaryStyleRecommendedRef.current = true;
          setAdvancedOptions((prev) => ({
            ...prev,
            summaryStyle: recommendation.style,
          }));
        }
      })
      .catch(() => {
        if (active && recommendationRequestRef.current === videoId) {
          setStyleRecommendation(null);
        }
      })
      .finally(() => {
        if (active && recommendationRequestRef.current === videoId) {
          setStyleRecommendationLoading(false);
          recommendationInFlightRef.current = null;
        }
      });

    return () => {
      active = false;
    };
  }, [
    activeTab,
    client,
    initialVideoUrl,
    initialYouTubeVideoId,
    isOpen,
    selectedPlatform,
    styleRecommendation?.style,
    videoUrl,
  ]);

  const buildOptions = (): TaskOptions => {
    const selectedModelId = advancedOptions.summaryModelId;
    const selectedModel = selectedModelId
      ? llmModels.find((model) =>
          model.model_id ? model.model_id === selectedModelId : model.provider === selectedModelId
        ) || null
      : null;

    const options: TaskOptions = {
      language: advancedOptions.language as TaskOptions["language"],
      enable_speaker_diarization: advancedOptions.speakerDiarization,
      summary_style: advancedOptions.summaryStyle || "auto",
      provider: selectedModel?.provider ?? null,
      model_id: selectedModel?.model_id ?? null,
    };

    return options;
  };

  const handleSubmit = async () => {
    if (activeTab === 'upload') {
      if (!selectedFile || isUploading) return;
      try {
        await uploadFile(selectedFile, buildOptions());
        handleClose();
      } catch {
        // useFileUpload handles toast
      }
      return;
    }

    if (!videoUrl.trim()) return;

    setIsCreating(true);
    try {
      const task = await client.createTask({
        source_type: 'youtube',
        source_url: videoUrl.trim(),
        options: buildOptions(),
      });
      notifySuccess(t("upload.taskCreated"));
      handleClose();
      router.push(`/tasks/${task.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("newTask.createFailed");
      notifyError(message, { persist: false });
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    // Reset state
    reset();
    setActiveTab('upload');
    setSelectedFile(null);
    setVideoUrl('');
    setSelectedPlatform('youtube');
    setShowAdvanced(true);
    setIsCreating(false);
    advancedTouchedRef.current = false;
    summaryStyleTouchedRef.current = false;
    summaryStyleRecommendedRef.current = false;
    recommendationRequestRef.current = null;
    recommendationInFlightRef.current = null;
    setStyleRecommendation(null);
    setStyleRecommendationLoading(false);
    preferencesRef.current = null;
    onClose();
  };

  const canSubmit = activeTab === 'upload'
    ? selectedFile && !isUploading
    : videoUrl.trim().length > 0 && !isCreating;

  return (
    // Radix Dialog 提供焦点陷阱 / Esc / 焦点恢复 / role=dialog。沿用原本的实心 surface 外观：
    // 用 inline style 覆盖 DialogContent 自带的 glass 背景，className 覆盖 grid→block、去内边距、放宽到 max-w-3xl。
    // showCloseButton={false}：保留头部原有的 X 按钮（走 handleClose 做状态清理）。
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="block w-full max-w-3xl sm:max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border p-0"
        style={{
          background: 'var(--app-surface)',
          borderColor: 'var(--app-glass-border)',
          boxShadow: 'var(--app-glass-shadow)',
        }}
      >
        {/* sr-only 标题：给对话框可访问名称；视觉标题仍由下方头部 h2 呈现 */}
        <DialogTitle className="sr-only">{t("task.newTask")}</DialogTitle>
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-8 py-6 border-b"
          style={{ background: 'var(--app-surface)', borderColor: 'var(--app-glass-border)' }}
        >
          <h2 className="text-2xl" style={{ fontWeight: 600, color: 'var(--app-text)' }}>
            {t("task.newTask")}
          </h2>
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-[var(--app-glass-hover)] transition-colors"
            style={{ color: 'var(--app-text-muted)' }}
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="px-8 py-6 space-y-6">
          {/* Tab Switch */}
          <div className="flex justify-center">
            <TabSwitch 
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </div>

          {/* Tab Content */}
          <div
            role="tabpanel"
            id={`tabpanel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
            tabIndex={0}
            className="space-y-6"
          >
            {activeTab === 'upload' ? (
              // Upload File Tab
              <div className="flex justify-center">
                <UploadZone
                  onFileSelect={handleFileSelect}
                  onFileRemove={handleFileRemove}
                  uploadProgress={uploadState.progress}
                  uploadedFile={selectedFile}
                  isUploading={isUploading}
                />
              </div>
            ) : (
              // Link Tab
              <div className="space-y-6">
                {/* Platform Selection */}
                <div className="flex justify-center">
                  <div
                    className="inline-flex rounded-lg border p-1"
                    style={{ borderColor: 'var(--app-glass-border)', background: 'var(--app-glass-bg)' }}
                  >
                    {platformTabs.map((tab) => {
                      const isActive = tab.id === selectedPlatform;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setSelectedPlatform(tab.id as Platform)}
                          className="px-6 py-2 rounded-md text-sm transition-all"
                          style={{
                            background: isActive ? 'var(--app-glass-bg-strong)' : 'transparent',
                            color: isActive ? 'var(--app-text)' : 'var(--app-text-muted)',
                            fontWeight: isActive ? 500 : 400,
                            boxShadow: isActive ? 'var(--app-glass-shadow)' : 'none',
                            border: isActive ? '1px solid var(--app-glass-border)' : '1px solid transparent'
                          }}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* URL Input */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <LinkIcon className="w-5 h-5" style={{ color: 'var(--app-text-muted)' }} />
                    <h3 className="text-base" style={{ fontWeight: 500, color: 'var(--app-text)' }}>
                      {t("newTask.pasteLink", {
                        platform: selectedPlatform === 'youtube' ? 'YouTube' : 'Bilibili'
                      })}
                    </h3>
                  </div>

                  <Input
                    type="url"
                    placeholder={platformInfo[selectedPlatform].placeholder}
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    className="w-full"
                  />

                  <div className="space-y-1" style={{ color: 'var(--app-text-subtle)', fontSize: '14px' }}>
                    <p>{t("newTask.supportedFormats")}</p>
                    <ul className="list-disc list-inside pl-2 space-y-1">
                      {platformInfo[selectedPlatform].formats.map((format, index) => (
                        <li key={index}>{format}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Advanced Options */}
            <div className="space-y-4">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm hover:opacity-70 transition-opacity"
                style={{ color: 'var(--app-text-muted)' }}
              >
                <span>{t("newTask.advancedOptions")}</span>
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showAdvanced && (
                <div className="border rounded-lg p-6 space-y-4" style={{ borderColor: 'var(--app-glass-border)', background: 'var(--app-glass-bg)' }}>
                  {/* Summary Model */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <label className="text-sm sm:w-32" style={{ color: 'var(--app-text-muted)' }}>
                      {t("newTask.summaryModel")}：
                    </label>
                    <SummaryModelSelect
                      models={llmModels}
                      value={advancedOptions.summaryModelId}
                      onChange={(value) => {
                        advancedTouchedRef.current = true;
                        setAdvancedOptions({ ...advancedOptions, summaryModelId: value });
                      }}
                      className="glass-control flex-1 sm:max-w-xs text-sm"
                    />
                  </div>

                  {/* Language Selection */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <label htmlFor="newtask-language" className="text-sm sm:w-32" style={{ color: 'var(--app-text-muted)' }}>
                      {t("newTask.language")}：
                    </label>
                    <select
                      id="newtask-language"
                      value={advancedOptions.language}
                      onChange={(e) => {
                        advancedTouchedRef.current = true;
                        setAdvancedOptions({ ...advancedOptions, language: e.target.value });
                      }}
                      className="glass-control flex-1 sm:max-w-xs px-3 py-2 rounded-lg text-sm"
                      style={{ color: 'var(--app-text)' }}
                    >
                      <option value="auto">{t("task.languageAuto")}</option>
                      <option value="zh">{t("task.languageZh")}</option>
                      <option value="en">{t("task.languageEn")}</option>
                    </select>
                  </div>

                  {/* Speaker Diarization */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <label id="newtask-diarization-label" className="text-sm sm:w-32" style={{ color: 'var(--app-text-muted)' }}>
                      {t("newTask.speakerDiarization")}：
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        aria-labelledby="newtask-diarization-label"
                        checked={advancedOptions.speakerDiarization}
                        onChange={(e) => {
                          advancedTouchedRef.current = true;
                          setAdvancedOptions({ ...advancedOptions, speakerDiarization: e.target.checked });
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm" style={{ color: 'var(--app-text)' }}>{t("newTask.enabled")}</span>
                    </label>
                  </div>

                  {/* Summary Style */}
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <label htmlFor="newtask-summary-style" className="text-sm sm:w-32 pt-2" style={{ color: 'var(--app-text-muted)' }}>
                      {t("newTask.summaryStyle")}：
                    </label>
                    <div className="flex-1 sm:max-w-xs">
                      <select
                        id="newtask-summary-style"
                        value={advancedOptions.summaryStyle}
                        onChange={(e) => {
                          advancedTouchedRef.current = true;
                          summaryStyleTouchedRef.current = true;
                          setAdvancedOptions({ ...advancedOptions, summaryStyle: e.target.value });
                        }}
                        disabled={summaryStyles.length === 0}
                        className="glass-control w-full px-3 py-2 rounded-lg text-sm disabled:opacity-50"
                        style={{ color: 'var(--app-text)' }}
                      >
                        {summaryStyles.length > 0 ? (
                          summaryStyles.map((style) => (
                            <option key={style.id} value={style.id}>
                              {style.name}
                            </option>
                          ))
                        ) : (
                          <option value="auto">{t("newTask.summaryAuto")}</option>
                        )}
                      </select>
                      {summaryStyles.length > 0 && (
                        <p className="text-xs mt-1" style={{ color: 'var(--app-text-subtle)' }}>
                          {summaryStyles.find((s) => s.id === advancedOptions.summaryStyle)?.focus}
                        </p>
                      )}
                      {styleRecommendationLoading && (
                        <p className="text-xs mt-2" style={{ color: 'var(--app-text-muted)' }}>
                          {t("newTask.summaryStyleRecommending")}
                        </p>
                      )}
                      {styleRecommendation && !styleRecommendationLoading && (
                        <p
                          className="text-xs mt-2 flex items-start gap-1.5"
                          style={{ color: 'var(--app-primary)' }}
                        >
                          <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span>
                            {t("newTask.summaryStyleRecommended", {
                              confidence: Math.round(styleRecommendation.confidence * 100),
                            })}{" "}
                            {styleRecommendation.reason}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="sticky bottom-0 flex items-center justify-end gap-3 px-8 py-6 border-t"
          style={{ background: 'var(--app-surface)', borderColor: 'var(--app-glass-border)' }}
        >
          <Button
            onClick={handleClose}
            className="glass-control px-6 py-2 rounded-lg text-sm"
            style={{
              color: 'var(--app-text-muted)',
            }}
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isCreating}
            className="px-8 py-2 rounded-lg text-sm transition-all"
            style={{
              background: (canSubmit && !isCreating) ? 'var(--app-primary)' : 'var(--app-glass-border)',
              color: (canSubmit && !isCreating) ? 'var(--app-button-primary-text)' : 'var(--app-text-subtle)',
              fontWeight: 600,
              cursor: (canSubmit && !isCreating) ? 'pointer' : 'not-allowed'
            }}
          >
            {isCreating && activeTab === 'link'
              ? t("newTask.creatingTask")
              : t("newTask.startProcessing")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
