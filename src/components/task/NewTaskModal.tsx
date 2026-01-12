"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { notifyError, notifySuccess } from '@/lib/notify';
import { X, Link as LinkIcon, ChevronDown, ChevronUp } from 'lucide-react';
import TabSwitch from './TabSwitch';
import UploadZone from './UploadZone';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { useAPIClient } from '@/lib/use-api-client';
import { useFileUpload } from '@/hooks/use-file-upload';
import type { LLMModel, TaskOptions } from '@/types/api';
import { useI18n } from '@/lib/i18n-context';

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Platform = 'youtube' | 'bilibili';

export default function NewTaskModal({ isOpen, onClose }: NewTaskModalProps) {
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
    summaryStyle: 'meeting'
  });
  const [llmModels, setLlmModels] = useState<LLMModel[]>([]);

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

    return {
      language: advancedOptions.language as TaskOptions["language"],
      enable_speaker_diarization: advancedOptions.speakerDiarization,
      summary_style: summaryStyleMap[advancedOptions.summaryStyle] || "meeting",
      provider: selectedModel?.provider ?? null,
      model_id: selectedModel?.model_id ?? null,
    };
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
                      onChange={(e) =>
                        setAdvancedOptions({ ...advancedOptions, summaryModelId: e.target.value || null })
                      }
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
                      onChange={(e) => setAdvancedOptions({ ...advancedOptions, language: e.target.value })}
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
                        onChange={(e) => setAdvancedOptions({ ...advancedOptions, speakerDiarization: e.target.checked })}
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
                      onChange={(e) => setAdvancedOptions({ ...advancedOptions, summaryStyle: e.target.value })}
                      className="glass-control flex-1 sm:max-w-xs px-3 py-2 rounded-lg text-sm"
                      style={{ color: 'var(--app-text)' }}
                    >
                      <option value="meeting">{t("newTask.summaryMeeting")}</option>
                      <option value="lecture">{t("newTask.summaryLecture")}</option>
                      <option value="podcast">{t("newTask.summaryPodcast")}</option>
                    </select>
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
