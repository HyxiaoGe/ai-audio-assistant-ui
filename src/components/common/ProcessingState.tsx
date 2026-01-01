import { Loader2, CheckCircle2, Circle } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import type { TaskStatus, SourceType } from "@/types/api";

interface ProcessingStateProps {
  progress?: number; // 0-100
  estimatedTime?: string; // e.g., "约3 分钟"
  status?: TaskStatus;
  sourceType?: SourceType; // "upload" | "youtube"
}

interface ProcessStep {
  label: string;
  status: 'completed' | 'processing' | 'pending';
  progress?: string; // e.g., "2:30/5:00"
}

export default function ProcessingState({
  progress = 65,
  estimatedTime,
  status,
  sourceType = "upload"
}: ProcessingStateProps) {
  const { t } = useI18n();
  const statusLabel = status ? t(`task.status.${status}`) : null;
  const isDone = status === "completed" || progress >= 100;

  // 判断是否为视频任务（YouTube/Bilibili）
  const isVideoTask = sourceType === "youtube";

  // 状态分组：将相似状态合并为同一个显示阶段
  const STATUS_GROUPS = {
    "preparing": ["queued", "resolving"],
    "downloading": ["downloading", "downloaded", "transcoding", "uploading", "uploaded", "resolved"],
    "extracting": ["extracting"],
    "transcribing": ["asr_submitting", "asr_polling", "transcribing"],
    "summarizing": ["summarizing"],
    "completed": ["completed"],
  };

  const getGroupForStatus = (status: TaskStatus): string | null => {
    for (const [group, statuses] of Object.entries(STATUS_GROUPS)) {
      if (statuses.includes(status)) return group;
    }
    return null;
  };

  const getStepsFromStatus = (value?: TaskStatus): ProcessStep[] | null => {
    if (!value) return null;
    if (value === "failed") {
      return [
        { label: t("task.status.queued"), status: "completed" },
        { label: t("task.status.downloading"), status: "completed" },
        { label: t("task.status.transcribing"), status: "completed" },
        { label: t("task.status.summarizing"), status: "pending" },
      ];
    }

    const currentGroup = getGroupForStatus(value);
    if (!currentGroup) return null;

    // 简化的步骤：只显示 4 个主要阶段
    // 根据任务类型和步骤状态显示不同文字
    const getStepLabel = (stepType: 'preparing' | 'media' | 'transcribing' | 'summarizing', stepStatus: 'completed' | 'processing' | 'pending'): string => {
      if (stepType === 'preparing') {
        return stepStatus === 'completed' ? t("task.stage.preparingDone") : t("task.stage.preparing");
      }
      if (stepType === 'media') {
        const baseKey = isVideoTask ? "downloading" : "extracting";
        return stepStatus === 'completed'
          ? t(`task.stage.${baseKey}Done`)
          : t(`task.stage.${baseKey}`);
      }
      if (stepType === 'transcribing') {
        return stepStatus === 'completed' ? t("task.stage.transcribingDone") : t("task.stage.transcribingActive");
      }
      if (stepType === 'summarizing') {
        return stepStatus === 'completed' ? t("task.stage.summarizingDone") : t("task.stage.summarizingActive");
      }
      return '';
    };

    // 判断每个步骤的状态
    const step1Status: 'completed' | 'processing' | 'pending' =
      ["preparing"].includes(currentGroup) ? "processing" : "completed";
    const step2Status: 'completed' | 'processing' | 'pending' =
      currentGroup === "downloading" || currentGroup === "extracting" ? "processing" :
      ["preparing"].includes(currentGroup) ? "pending" : "completed";
    const step3Status: 'completed' | 'processing' | 'pending' =
      currentGroup === "transcribing" ? "processing" :
      ["preparing", "downloading", "extracting"].includes(currentGroup) ? "pending" : "completed";
    const step4Status: 'completed' | 'processing' | 'pending' =
      currentGroup === "summarizing" ? "processing" :
      currentGroup === "completed" ? "completed" : "pending";

    const steps: ProcessStep[] = [
      {
        label: getStepLabel('preparing', step1Status),
        status: step1Status,
      },
      {
        label: getStepLabel('media', step2Status),
        status: step2Status,
      },
      {
        label: getStepLabel('transcribing', step3Status),
        status: step3Status,
      },
      {
        label: getStepLabel('summarizing', step4Status),
        status: step4Status,
      },
    ];

    return steps;
  };
  const getSteps = (): ProcessStep[] => {
    const statusSteps = getStepsFromStatus(status);
    if (statusSteps) return statusSteps;

    if (progress < 10) {
      return [
        { label: t("processingState.pending"), status: 'processing' },
        { label: t("processingState.transcribing"), status: 'pending' },
        { label: t("processingState.summarizing"), status: 'pending' },
        { label: t("processing.stepFinalizing"), status: 'pending' }
      ];
    }

    if (progress < 60) {
      return [
        { label: t("processingState.pending"), status: 'completed' },
        { label: t("processingState.transcribing"), status: 'processing', progress: '2:30/5:00' },
        { label: t("processingState.summarizing"), status: 'pending' },
        { label: t("processing.stepFinalizing"), status: 'pending' }
      ];
    }

    if (progress < 90) {
      return [
        { label: t("processingState.pending"), status: 'completed' },
        { label: t("processingState.transcribing"), status: 'completed' },
        { label: t("processingState.summarizing"), status: 'processing' },
        { label: t("processing.stepFinalizing"), status: 'pending' }
      ];
    }

    if (progress < 100) {
      return [
        { label: t("processingState.pending"), status: 'completed' },
        { label: t("processingState.transcribing"), status: 'completed' },
        { label: t("processingState.summarizing"), status: 'completed' },
        { label: t("processing.stepFinalizing"), status: 'processing' }
      ];
    }

    return [
      { label: t("processingState.pending"), status: 'completed' },
      { label: t("processingState.transcribing"), status: 'completed' },
      { label: t("processingState.summarizing"), status: 'completed' },
      { label: t("processing.stepDone"), status: 'completed' }
    ];
  };

  const steps = getSteps();

  return (
    <div className="flex items-center justify-center px-6" style={{ width: '100%' }}>
      {/* 处理进度卡片 */}
      <div
        className="glass-panel w-full rounded-xl"
        style={{
          maxWidth: '480px',
          padding: '48px',
        }}
      >
        {/* 加载动画图标 */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <Loader2
              className="animate-spin"
              style={{
                width: '64px',
                height: '64px',
                color: "var(--app-primary)"
              }}
            />
            {/* 添加一个脉搏效果的圆环 */}
            <div 
              className="absolute inset-0 rounded-full animate-ping"
              style={{
                background: "var(--app-primary)",
                opacity: 0.5
              }}
            />
          </div>
        </div>

        {/* 主标题 */}
        <h2
          className="text-center text-xl mb-6"
          style={{
            fontWeight: 600,
            color: "var(--app-text-strong)"
          }}
        >
          {isDone ? t("processing.done") : t("processing.inProgress")}
        </h2>
        {statusLabel && (
          <p
            className="text-center text-sm mb-4"
            style={{ color: "var(--app-text-muted)" }}
          >
            {t("task.processingProgress")}: {statusLabel}
          </p>
        )}

        {/* 进度条 */}
        <div className="mb-2 relative">
          <div
            className="w-full rounded overflow-hidden relative"
            style={{
              height: '8px',
              background: "var(--app-glass-border)"
            }}
          >
            <div
              className="h-full transition-all duration-500 relative overflow-hidden"
              style={{
                width: `${progress}%`,
                background: "var(--app-action-gradient)"
              }}
            >
              {/* 添加一个流动的光泽效果 */}
              <div 
                className="absolute inset-0 animate-pulse"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)'
                }}
              />
            </div>
          </div>
        </div>

        {/* 进度百分比 */}
        <p
          className="text-center text-sm mb-4"
          style={{
            fontWeight: 500,
            color: "var(--app-text-muted)"
          }}
        >
          {progress}%
        </p>

        {/* 预计时间 */}
        <p
          className="text-center text-sm mb-8"
          style={{
            color: "var(--app-text-muted)"
          }}
        >
          {t("processing.etaPrefix")}{estimatedTime || t("task.etaMinutes", { minutes: 3 })}
        </p>

        {/* 处理步骤列表 */}
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div
              key={index}
              className="flex items-center gap-3"
              style={{ height: '36px' }}
            >
              {/* 状态图标 */}
              {step.status === 'completed' && (
                <CheckCircle2
                  className="flex-shrink-0"
                  style={{
                    width: '20px',
                    height: '20px',
                    color: "var(--app-success)"
                  }}
                />
              )}
              {step.status === 'processing' && (
                <Loader2
                  className="flex-shrink-0 animate-spin"
                  style={{
                    width: '20px',
                    height: '20px',
                    color: "var(--app-primary)"
                  }}
                />
              )}
              {step.status === 'pending' && (
                <Circle
                  className="flex-shrink-0"
                  style={{
                    width: '20px',
                    height: '20px',
                    color: "var(--app-text-faint)"
                  }}
                />
              )}

              {/* 步骤文字 */}
              <span
                className="text-sm"
                style={{
                  color:
                    step.status === 'pending'
                      ? "var(--app-text-subtle)"
                      : "var(--app-text-strong)",
                  fontWeight: step.status === 'pending' ? 400 : 500
                }}
              >
                {step.label}
                {step.progress && ` (${step.progress})`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
