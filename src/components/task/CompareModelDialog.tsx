"use client";

// 对比弹窗:改用 Radix Dialog(焦点陷阱 / Esc / 焦点恢复 / role=dialog)。
// 原本就用 glass-panel-strong + max-w-lg,与 DialogContent 默认基本一致,仅覆盖 grid→block 与圆角。
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import type { LLMModel } from '@/types/api';

interface CompareModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelGroups: { label: string; models: LLMModel[] }[];
  selectedModels: string[];
  onToggleModel: (value: string) => void;
  compareError: string | null;
  compareLoading: boolean;
  onStart: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

export function CompareModelDialog({
  open,
  onOpenChange,
  modelGroups,
  selectedModels,
  onToggleModel,
  compareError,
  compareLoading,
  onStart,
  t,
}: CompareModelDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="block w-full max-w-lg sm:max-w-lg rounded-2xl space-y-4">
        <DialogTitle className="text-lg" style={{ fontWeight: 600, color: 'var(--app-text)' }}>
          {t("task.compareTitle")}
        </DialogTitle>
        <DialogDescription className="text-sm" style={{ color: 'var(--app-text-subtle)' }}>
          {t("task.compareHint")}
        </DialogDescription>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {modelGroups.map((group) => (
            <div key={group.label} className="space-y-2">
              <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--app-text-muted)' }}>
                {group.label}
              </div>
              <div className="space-y-2">
                {group.models.map((model) => {
                  const value = model.model_id || model.provider;
                  const isChecked = selectedModels.includes(value);
                  const parts: string[] = [model.display_name || model.model_id || model.provider];
                  if (model.cost_tier) {
                    parts.push(t(`task.summaryModelCost${model.cost_tier.charAt(0).toUpperCase() + model.cost_tier.slice(1)}` as const));
                  }
                  if (!model.is_available) {
                    parts.push(t("task.summaryModelUnavailable"));
                  } else if (model.is_recommended) {
                    parts.push(t("task.summaryModelRecommended"));
                  }
                  return (
                    <label
                      key={value}
                      className="flex items-center gap-2 text-sm"
                      style={{ color: model.is_available ? 'var(--app-text)' : 'var(--app-text-subtle)' }}
                    >
                      <input
                        type="checkbox"
                        disabled={!model.is_available}
                        checked={isChecked}
                        onChange={() => onToggleModel(value)}
                      />
                      <span>{parts.join(" · ")}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {compareError && (
          <p className="text-sm" style={{ color: 'var(--app-danger)' }}>
            {compareError}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => onOpenChange(false)}
            className="text-sm px-4 py-2 rounded-lg"
            style={{ background: 'var(--app-glass-bg-strong)', color: 'var(--app-text-muted)' }}
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={onStart}
            disabled={selectedModels.length < 2 || compareLoading}
            className="text-sm px-4 py-2 rounded-lg disabled:opacity-50"
            style={{ background: 'var(--app-primary)', color: 'var(--app-button-primary-text)' }}
          >
            {compareLoading ? t("task.compareLoadingButton") : t("task.compareStart")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
