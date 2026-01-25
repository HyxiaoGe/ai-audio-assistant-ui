"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { notifyError, notifySuccess } from '@/lib/notify';
import { X, Link as LinkIcon, ChevronDown, ChevronUp } from 'lucide-react';
import TabSwitch from './TabSwitch';
import UploadZone from './UploadZone';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { useAPIClient } from '@/lib/use-api-client';
import { useFileUpload } from '@/hooks/use-file-upload';
import type { LLMModel, TaskOptions, UserPreferences } from '@/types/api';
import { useI18n } from '@/lib/i18n-context';

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-fill with a YouTube video URL */
  initialVideoUrl?: string;
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

const mapSummaryStyleFromPreference = (value?: TaskOptions["summary_style"]) => {
  if (value === "learning") return "lecture";
  if (value === "interview") return "podcast";
  if (value === "meeting") return "meeting";
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

export default function NewTaskModal({ isOpen, onClose, initialVideoUrl }: NewTaskModalProps) {
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
    summaryStyle: 'meeting',
    enableVisualSummary: false,
    visualTypes: [] as string[]
  });
  const [llmModels, setLlmModels] = useState<LLMModel[]>([]);
  const preferencesRef = useRef<UserPreferences | null>(null);
  const advancedTouchedRef = useRef(false);

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
    const loadModels = async () => {
      try {
        const result = await client.getLLMModels();
        if (active) {
          setLlmModels(result.models || []);
        }
      } catch {
        if (active) {
          setLlmModels([]);
        }
      }
    };
    loadModels();
    return () => {
      active = false;
    };
  }, [client, isOpen, locale]);

  const applyPreferenceDefaults = useCallback((preferences: UserPreferences) => {
    if (advancedTouchedRef.current) return;
    const defaults = preferences.task_defaults || {};
    const preferredSummaryStyle = mapSummaryStyleFromPreference(defaults.summary_style);
    const preferredModelId = resolvePreferredModel(preferences, llmModels);
    const fallbackLanguage = getStoredDefaultLanguage();

    setAdvancedOptions((prev) => ({
      ...prev,
      language: defaults.language || fallbackLanguage || prev.language,
      speakerDiarization:
        typeof defaults.enable_speaker_diarization === "boolean"
          ? defaults.enable_speaker_diarization
          : prev.speakerDiarization,
      summaryStyle: preferredSummaryStyle || prev.summaryStyle,
      summaryModelId: preferredModelId ?? null,
    }));
  }, [llmModels]);

  useEffect(() => {
    if (!isOpen) return;
    advancedTouchedRef.current = false;
    const fallbackLanguage = getStoredDefaultLanguage();
    if (fallbackLanguage) {
      setAdvancedOptions((prev) => ({
        ...prev,
        language: fallbackLanguage,
      }));
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

  const modelGroups = useMemo(() => {
    const groups = new Map<string, LLMModel[]>();
    llmModels.forEach((model) => {
      const key = model.display_name || model.provider;
      const list = groups.get(key) || [];
      list.push(model);
      groups.set(key, list);
    });
    return Array.from(groups.entries()).map(([label, models]) => ({
      label,
      models,
    }));
  }, [llmModels]);


  const renderModelOptions = useMemo(
    () =>
      modelGroups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.models.map((model) => {
            const suffix = model.is_available
              ? (model.is_recommended ? ` ${t("task.summaryModelRecommended")}` : "")
              : ` ${t("task.summaryModelUnavailable")}`;
            const label = model.model_id ? `  ${model.model_id}` : `  ${model.provider}`;
            return (
              <option
                key={model.model_id || model.provider}
                value={model.model_id || model.provider}
                disabled={!model.is_available}
              >
                {label}{suffix}
              </option>
            );
          })}
        </optgroup>
      )),
    [modelGroups, t]
  );

  const buildOptions = (): TaskOptions => {
    const summaryStyleMap: Record<string, TaskOptions["summary_style"]> = {
      meeting: "meeting",
      lecture: "learning",
      podcast: "interview",
    };
    const selectedModelId = advancedOptions.summaryModelId;
    const selectedModel = selectedModelId
      ? llmModels.find((model) =>
          model.model_id ? model.model_id === selectedModelId : model.provider === selectedModelId
        ) || null
      : null;

    const options: TaskOptions = {
      language: advancedOptions.language as TaskOptions["language"],
      enable_speaker_diarization: advancedOptions.speakerDiarization,
      summary_style: summaryStyleMap[advancedOptions.summaryStyle] || "meeting",
      provider: selectedModel?.provider ?? null,
      model_id: selectedModel?.model_id ?? null,
    };

    // 添加可视化摘要选项
    if (advancedOptions.enableVisualSummary && advancedOptions.visualTypes.length > 0) {
      options.enable_visual_summary = true;
      options.visual_types = advancedOptions.visualTypes as TaskOptions["visual_types"];
    }

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
    preferencesRef.current = null;
    onClose();
  };

  const canSubmit = activeTab === 'upload'
    ? selectedFile && !isUploading
    : videoUrl.trim().length > 0 && !isCreating;

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15, 23, 42, 0.6)' }}
      onClick={handleClose}
    >
      <div 
        className="glass-panel-strong relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="sticky top-0 z-10 flex items-center justify-between px-8 py-6 border-b"
          style={{ background: 'var(--app-glass-bg-strong)', borderColor: 'var(--app-glass-border)' }}
        >
          <h2 className="text-2xl" style={{ fontWeight: 600, color: 'var(--app-text)' }}>
            {t("task.newTask")}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-[var(--app-glass-hover)] transition-colors"
            style={{ color: 'var(--app-text-muted)' }}
          >
            <X className="w-6 h-6" />
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
          <div className="space-y-6">
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
                    <select
                      value={advancedOptions.summaryModelId ?? ''}
                      onChange={(e) => {
                        advancedTouchedRef.current = true;
                        setAdvancedOptions({ ...advancedOptions, summaryModelId: e.target.value || null });
                      }}
                      disabled={llmModels.length === 0}
                      className="glass-control flex-1 sm:max-w-xs px-3 py-2 rounded-lg text-sm disabled:opacity-50"
                      style={{ color: 'var(--app-text)' }}
                    >
                      <option value="">{t("task.summaryModelAutoOption")}</option>
                      {renderModelOptions}
                    </select>
                  </div>

                  {/* Language Selection */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <label className="text-sm sm:w-32" style={{ color: 'var(--app-text-muted)' }}>
                      {t("newTask.language")}：
                    </label>
                    <select
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
                    <label className="text-sm sm:w-32" style={{ color: 'var(--app-text-muted)' }}>
                      {t("newTask.speakerDiarization")}：
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
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
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <label className="text-sm sm:w-32" style={{ color: 'var(--app-text-muted)' }}>
                      {t("newTask.summaryStyle")}：
                    </label>
                    <select
                      value={advancedOptions.summaryStyle}
                      onChange={(e) => {
                        advancedTouchedRef.current = true;
                        setAdvancedOptions({ ...advancedOptions, summaryStyle: e.target.value });
                      }}
                      className="glass-control flex-1 sm:max-w-xs px-3 py-2 rounded-lg text-sm"
                      style={{ color: 'var(--app-text)' }}
                    >
                      <option value="meeting">{t("newTask.summaryMeeting")}</option>
                      <option value="lecture">{t("newTask.summaryLecture")}</option>
                      <option value="podcast">{t("newTask.summaryPodcast")}</option>
                    </select>
                  </div>

                  {/* Visual Summary */}
                  <div className="border-t pt-4 space-y-4" style={{ borderColor: 'var(--app-glass-border)' }}>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <label className="text-sm sm:w-32" style={{ color: 'var(--app-text-muted)' }}>
                        {t("newTask.visualSummary")}：
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={advancedOptions.enableVisualSummary}
                          onChange={(e) => {
                            advancedTouchedRef.current = true;
                            setAdvancedOptions({
                              ...advancedOptions,
                              enableVisualSummary: e.target.checked,
                              visualTypes: e.target.checked ? advancedOptions.visualTypes : []
                            });
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm" style={{ color: 'var(--app-text)' }}>
                          {t("newTask.autoGenerateVisualSummary")}
                        </span>
                      </label>
                    </div>

                    {advancedOptions.enableVisualSummary && (
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                        <label className="text-sm sm:w-32" style={{ color: 'var(--app-text-muted)' }}>
                          {t("newTask.visualTypes")}：
                        </label>
                        <div className="flex-1 space-y-2">
                          {[
                            { value: 'mindmap', label: t("newTask.visualMindmap") },
                            { value: 'timeline', label: t("newTask.visualTimeline") },
                            { value: 'flowchart', label: t("newTask.visualFlowchart") }
                          ].map((type) => (
                            <label key={type.value} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={advancedOptions.visualTypes.includes(type.value)}
                                onChange={(e) => {
                                  advancedTouchedRef.current = true;
                                  const newTypes = e.target.checked
                                    ? [...advancedOptions.visualTypes, type.value]
                                    : advancedOptions.visualTypes.filter(t => t !== type.value);
                                  setAdvancedOptions({ ...advancedOptions, visualTypes: newTypes });
                                }}
                                className="w-4 h-4"
                              />
                              <span className="text-sm" style={{ color: 'var(--app-text)' }}>
                                {type.label}
                              </span>
                            </label>
                          ))}
                          <p className="text-xs mt-2" style={{ color: 'var(--app-text-subtle)' }}>
                            {t("newTask.visualSummaryHint")}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div 
          className="sticky bottom-0 flex items-center justify-end gap-3 px-8 py-6 border-t"
          style={{ background: 'var(--app-glass-bg-strong)', borderColor: 'var(--app-glass-border)' }}
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
              ? t("newTask.validatingVideo")
              : t("newTask.startProcessing")}
          </Button>
        </div>
      </div>
    </div>
  );
}
