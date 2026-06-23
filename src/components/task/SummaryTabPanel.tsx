"use client";

import dynamic from 'next/dynamic';
import type { ReactNode, RefObject } from 'react';
import { Lightbulb } from 'lucide-react';
import TabSwitch from '@/components/task/TabSwitch';
import { SummaryModelSelect } from '@/components/task/SummaryModelSelect';
import { ActionItemToggle } from '@/components/task/ActionItemToggle';
import type { LLMModel, SummaryRegenerateType, StreamingImage } from '@/types/api';
import type { ActionItem } from '@/lib/summary-parse';

// MarkdownContent 内含 react-markdown 全家桶,经 next/dynamic 懒加载移出首屏(同 TaskDetail 原配置)。
const MarkdownContent = dynamic(
  () => import('@/components/task/MarkdownContent').then((m) => m.MarkdownContent),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-16">
        <div
          className="size-4 border-2 rounded-full animate-spin"
          style={{ borderColor: 'var(--app-primary) transparent var(--app-primary) var(--app-primary)' }}
        />
      </div>
    ),
  }
);

interface KeyPoint {
  text: string;
  timeReference: string;
}

interface SummaryTabPanelProps {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  llmModels: LLMModel[];
  summaryModelUsed: Record<SummaryRegenerateType, string | null>;
  summaryModelSelection: Record<SummaryRegenerateType, string | null>;
  onModelSelectionChange: (type: SummaryRegenerateType, value: string | null) => void;
  summaryStreaming: { overview: boolean; key_points: boolean; action_items: boolean };
  summaryStreamContent: Record<SummaryRegenerateType, string>;
  summaryOverviewMarkdown: string;
  keyPointsMarkdown: string;
  actionItemsMarkdown: string;
  keyPoints: KeyPoint[];
  actionItems: ActionItem[];
  detectedStyleName: string | null;
  transcriptStageReached: boolean;
  summaryError: string | null;
  imageModelUsed: string | null;
  streamingImages: Map<string, StreamingImage>;
  mediaToken: string | null;
  compareMode: boolean;
  compareSummaryType: SummaryRegenerateType;
  renderCompareView: () => ReactNode;
  renderModelProvenance: (provider?: string | null) => ReactNode;
  compareDialog: ReactNode;
  onRegenerate: (type: SummaryRegenerateType) => void;
  onOpenCompare: () => void;
  onTimeClick: (timeRef: string) => void;
  onToggleActionItem: (id: string) => void;
  getSummaryEmptyText: (summaryType: SummaryRegenerateType, emptyKey: string) => string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

export function SummaryTabPanel({
  tabs,
  activeTab,
  onTabChange,
  scrollRef,
  llmModels,
  summaryModelUsed,
  summaryModelSelection,
  onModelSelectionChange,
  summaryStreaming,
  summaryStreamContent,
  summaryOverviewMarkdown,
  keyPointsMarkdown,
  actionItemsMarkdown,
  keyPoints,
  actionItems,
  detectedStyleName,
  transcriptStageReached,
  summaryError,
  imageModelUsed,
  streamingImages,
  mediaToken,
  compareMode,
  compareSummaryType,
  renderCompareView,
  renderModelProvenance,
  compareDialog,
  onRegenerate,
  onOpenCompare,
  onTimeClick,
  onToggleActionItem,
  getSummaryEmptyText,
  t,
}: SummaryTabPanelProps) {
  return (
    <div className="flex-1 flex flex-col" style={{ maxWidth: '50%' }}>
      {/* Tab Switch */}
      <div className="flex justify-center border-b" style={{ borderColor: 'var(--app-glass-border)' }}>
        <TabSwitch
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
      </div>

      {/* Tab Content */}
      <div
        ref={scrollRef}
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={0}
        className="flex-1 overflow-y-auto p-6"
      >
                {/* Summary Tab */}
                {activeTab === 'summary' && (
                  <div className="space-y-6">
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                        <div>
                          <h3 className="text-lg" style={{ fontWeight: 600, color: 'var(--app-text)' }}>
                            {t("task.summaryOverview")}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--app-text-subtle)' }}>
                              {t("task.summaryModelLabel")}
                              {renderModelProvenance(summaryModelUsed.overview)}
                            </p>
                            <button
                              onClick={onOpenCompare}
                              disabled={llmModels.filter((model) => model.is_available).length < 2}
                              className="text-xs px-2 py-0.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{
                                background: 'var(--app-glass-bg-strong)',
                                color: 'var(--app-text)',
                                border: '1px solid var(--app-glass-border)',
                              }}
                            >
                              {t("task.compareModels")}</button>
                          </div>
                          {detectedStyleName && (
                            <p className="text-xs mt-1" style={{ color: 'var(--app-text-subtle)' }}>
                              {t("task.detectedStyle", { style: detectedStyleName })}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <SummaryModelSelect
                            models={llmModels}
                            value={summaryModelSelection.overview ?? null}
                            onChange={(value) => onModelSelectionChange('overview', value)}
                            disabled={summaryStreaming.overview || llmModels.length === 0}
                            className="text-xs"
                          />
                          <button
                            onClick={() => onRegenerate('overview')}
                            disabled={summaryStreaming.overview}
                            className="text-xs px-3 py-1 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: 'var(--app-primary-soft)', color: 'var(--app-primary)' }}
                          >
                            {summaryStreaming.overview ? t("task.summaryRetrying") : t("task.summaryRetry")}
                          </button>
                        </div>
                      </div>
                      {transcriptStageReached && !summaryOverviewMarkdown && !summaryStreaming.overview ? (
                        <p className="text-base leading-7" style={{ color: 'var(--app-text-subtle)' }}>
                          {t("task.summaryGenerating")}
                        </p>
                      ) : summaryError && !summaryOverviewMarkdown ? (
                        // 仅在「尚无已落地的摘要正文」时展示右栏错误。已成功展示过 overview 后，
                        // 一次瞬时重载错误（如 completed 重载时 getSummary 抖动）不应把已展示内容连带抹掉，
                        // 与转写「失败不连带已展示内容」同一语义。
                        <p className="text-base leading-7" style={{ color: 'var(--app-danger)' }}>
                          {summaryError}
                        </p>
                      ) : summaryStreaming.overview && summaryStreamContent.overview ? (
                        <MarkdownContent content={summaryStreamContent.overview} imageModel={imageModelUsed} streamingImages={streamingImages} mediaToken={mediaToken} />
                      ) : compareMode && compareSummaryType === "overview" ? (
                        renderCompareView()
                      ) : summaryOverviewMarkdown ? (
                        <MarkdownContent content={summaryOverviewMarkdown} imageModel={imageModelUsed} streamingImages={streamingImages} mediaToken={mediaToken} />
                      ) : (
                        <p className="text-base leading-7" style={{ color: 'var(--app-text-subtle)' }}>
                          {getSummaryEmptyText("overview", "task.summaryEmpty")}
                        </p>
                      )}
                    </div>

                  </div>
                )}

                {/* Key Points Tab */}
                {activeTab === 'keypoints' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg" style={{ fontWeight: 600, color: 'var(--app-text)' }}>
                          {t("task.keyPointsTitle")}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--app-text-subtle)' }}>
                            {t("task.summaryModelLabel")}
                            {renderModelProvenance(summaryModelUsed.key_points)}
                          </p>
                          <button
                            onClick={onOpenCompare}
                            disabled={llmModels.filter((model) => model.is_available).length < 2}
                            className="text-xs px-2 py-0.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              background: 'var(--app-glass-bg-strong)',
                              color: 'var(--app-text)',
                              border: '1px solid var(--app-glass-border)',
                            }}
                          >
                            {t("task.compareModels")}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <SummaryModelSelect
                          models={llmModels}
                          value={summaryModelSelection.key_points ?? null}
                          onChange={(value) => onModelSelectionChange('key_points', value)}
                          disabled={summaryStreaming.key_points || llmModels.length === 0}
                          className="text-xs"
                        />
                        <button
                          onClick={() => onRegenerate('key_points')}
                          disabled={summaryStreaming.key_points}
                          className="text-xs px-3 py-1 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ background: 'var(--app-primary-soft)', color: 'var(--app-primary)' }}
                        >
                          {summaryStreaming.key_points ? t("task.summaryRetrying") : t("task.summaryRetry")}
                        </button>
                      </div>
                    </div>
                    {summaryStreaming.key_points && summaryStreamContent.key_points ? (
                      <MarkdownContent content={summaryStreamContent.key_points} streamingImages={streamingImages} mediaToken={mediaToken} />
                    ) : compareMode && compareSummaryType === "key_points" ? (
                      renderCompareView()
                    ) : keyPointsMarkdown ? (
                      // V1.2 format: Render full Markdown content
                      <MarkdownContent content={keyPointsMarkdown} streamingImages={streamingImages} mediaToken={mediaToken} />
                    ) : keyPoints.length > 0 ? (
                      // Old format with time references
                      keyPoints.map((point, index) => (
                          <div key={index} className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-1">
                              <Lightbulb className="w-5 h-5" style={{ color: 'var(--app-warning)' }} />
                            </div>
                            <div className="flex-1">
                              <p className="text-base mb-1" style={{ color: 'var(--app-text)' }}>
                                {point.text}
                              </p>
                              <button
                                onClick={() => onTimeClick(point.timeReference)}
                                className="text-sm hover:underline"
                                style={{ color: 'var(--app-primary)' }}
                              >
                                ↗{point.timeReference} {t("task.keyPointDetail")}
                              </button>
                            </div>
                          </div>
                        ))
                    ) : (
                      <p className="text-base leading-7" style={{ color: 'var(--app-text-subtle)' }}>
                        {getSummaryEmptyText("key_points", "task.keyPointsEmpty")}
                      </p>
                    )}
                  </div>
                )}

                {/* Action Items Tab */}
                {activeTab === 'actions' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg" style={{ fontWeight: 600, color: 'var(--app-text)' }}>
                          {t("task.tabs.actions")}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--app-text-subtle)' }}>
                            {t("task.summaryModelLabel")}
                            {renderModelProvenance(summaryModelUsed.action_items)}
                          </p>
                          <button
                            onClick={onOpenCompare}
                            disabled={llmModels.filter((model) => model.is_available).length < 2}
                            className="text-xs px-2 py-0.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              background: 'var(--app-glass-bg-strong)',
                              color: 'var(--app-text)',
                              border: '1px solid var(--app-glass-border)',
                            }}
                          >
                            {t("task.compareModels")}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <SummaryModelSelect
                          models={llmModels}
                          value={summaryModelSelection.action_items ?? null}
                          onChange={(value) => onModelSelectionChange('action_items', value)}
                          disabled={summaryStreaming.action_items || llmModels.length === 0}
                          className="text-xs"
                        />
                        <button
                          onClick={() => onRegenerate('action_items')}
                          disabled={summaryStreaming.action_items}
                          className="text-xs px-3 py-1 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ background: 'var(--app-primary-soft)', color: 'var(--app-primary)' }}
                        >
                          {summaryStreaming.action_items ? t("task.summaryRetrying") : t("task.summaryRetry")}
                        </button>
                      </div>
                    </div>
                    {summaryStreaming.action_items && summaryStreamContent.action_items ? (
                      <MarkdownContent content={summaryStreamContent.action_items} streamingImages={streamingImages} mediaToken={mediaToken} />
                    ) : compareMode && compareSummaryType === "action_items" ? (
                      renderCompareView()
                    ) : actionItemsMarkdown ? (
                      // V1.2 format: Render full Markdown content
                      <MarkdownContent content={actionItemsMarkdown} streamingImages={streamingImages} mediaToken={mediaToken} />
                    ) : actionItems.length > 0 ? (
                      // Old format with task/assignee/deadline structure
                      actionItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start gap-3 p-3 rounded-lg border transition-colors"
                          style={{
                            borderColor: 'var(--app-glass-border)',
                            background: item.completed ? 'var(--app-glass-bg-strong)' : 'var(--app-glass-bg)'
                          }}
                        >
                          <ActionItemToggle
                            completed={item.completed}
                            label={item.task}
                            onToggle={() => onToggleActionItem(item.id)}
                          />
                          <div className="flex-1">
                            <p
                              className="text-base mb-1"
                              style={{
                                color: item.completed ? 'var(--app-text-subtle)' : 'var(--app-text)',
                                textDecoration: item.completed ? 'line-through' : 'none'
                              }}
                            >
                              {item.task}
                            </p>
                            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--app-text-muted)' }}>
                              <span>@{item.assignee}</span>
                              <span>·</span>
                              <span>{t("task.deadline", { date: item.deadline })}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-base leading-7" style={{ color: 'var(--app-text-subtle)' }}>
                        {getSummaryEmptyText("action_items", "task.actionItemsEmpty")}
                      </p>
                    )}
                  </div>
                )}

      </div>

      {compareDialog}
    </div>
  );
}
