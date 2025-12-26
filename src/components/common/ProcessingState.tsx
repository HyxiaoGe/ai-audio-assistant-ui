import { Loader2, CheckCircle2, Circle } from 'lucide-react';

interface ProcessingStateProps {
  progress?: number; // 0-100
  currentStep?: number; // 1-4
  estimatedTime?: string; // e.g., "约3 分钟"
}

interface ProcessStep {
  label: string;
  status: 'completed' | 'processing' | 'pending';
  progress?: string; // e.g., "2:30/5:00"
}

export default function ProcessingState({
  progress = 65,
  currentStep = 2,
  estimatedTime = '约3 分钟'
}: ProcessingStateProps) {
  const getSteps = (): ProcessStep[] => {
    if (progress < 10) {
      return [
        { label: '上传完成', status: 'completed' },
        { label: '音频转写中...', status: 'pending' },
        { label: 'AI 摘要生成', status: 'pending' },
        { label: '完成中', status: 'pending' }
      ];
    }

    if (progress < 60) {
      return [
        { label: '上传完成', status: 'completed' },
        { label: '音频转写中...', status: 'processing', progress: '2:30/5:00' },
        { label: 'AI 摘要生成', status: 'pending' },
        { label: '完成中', status: 'pending' }
      ];
    }

    if (progress < 90) {
      return [
        { label: '上传完成', status: 'completed' },
        { label: '音频转写中...', status: 'completed' },
        { label: 'AI 摘要生成', status: 'processing' },
        { label: '完成中', status: 'pending' }
      ];
    }

    if (progress < 100) {
      return [
        { label: '上传完成', status: 'completed' },
        { label: '音频转写中...', status: 'completed' },
        { label: 'AI 摘要生成', status: 'completed' },
        { label: '完成中', status: 'processing' }
      ];
    }

    return [
      { label: '上传完成', status: 'completed' },
      { label: '音频转写中...', status: 'completed' },
      { label: 'AI 摘要生成', status: 'completed' },
      { label: '完成', status: 'completed' }
    ];
  };

  const steps = getSteps();

  return (
    <div className="flex items-center justify-center px-6" style={{ width: '100%' }}>
      {/* 处理进度卡片 */}
      <div
        className="w-full rounded-xl border"
        style={{
          maxWidth: '480px',
          background: '#FFFFFF',
          borderColor: '#E2E8F0',
          padding: '48px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
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
                color: '#3B82F6'
              }}
            />
            {/* 添加一个脉搏效果的圆环 */}
            <div 
              className="absolute inset-0 rounded-full animate-ping"
              style={{
                background: 'rgba(59, 130, 246, 0.2)',
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
            color: '#1E293B'
          }}
        >
          {progress >= 100 ? '处理完成' : '正在处理你的音频...'}
        </h2>

        {/* 进度条 */}
        <div className="mb-2 relative">
          <div
            className="w-full rounded overflow-hidden relative"
            style={{
              height: '8px',
              background: '#E2E8F0'
            }}
          >
            <div
              className="h-full transition-all duration-500 relative overflow-hidden"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #3B82F6 0%, #2563EB 100%)'
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
            color: '#64748B'
          }}
        >
          {progress}%
        </p>

        {/* 预计时间 */}
        <p
          className="text-center text-sm mb-8"
          style={{
            color: '#64748B'
          }}
        >
          预计剩余时间：{estimatedTime}
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
                    color: '#10B981'
                  }}
                />
              )}
              {step.status === 'processing' && (
                <Loader2
                  className="flex-shrink-0 animate-spin"
                  style={{
                    width: '20px',
                    height: '20px',
                    color: '#3B82F6'
                  }}
                />
              )}
              {step.status === 'pending' && (
                <Circle
                  className="flex-shrink-0"
                  style={{
                    width: '20px',
                    height: '20px',
                    color: '#CBD5E1'
                  }}
                />
              )}

              {/* 步骤文字 */}
              <span
                className="text-sm"
                style={{
                  color: step.status === 'pending' ? '#94A3B8' : '#1E293B',
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
