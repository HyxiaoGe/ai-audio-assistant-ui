import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  type?: 'network' | 'processing' | 'general';
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export default function ErrorState({
  type = 'general',
  title,
  description,
  onRetry,
  retryLabel = '重试'
}: ErrorStateProps) {
  // 默认配置
  const configs = {
    network: {
      icon: '❌',
      defaultTitle: '网络连接失败',
      defaultDescription: '请检查网络后重试'
    },
    processing: {
      icon: '⚠️',
      defaultTitle: '处理失败',
      defaultDescription: '任务处理失败，请重试'
    },
    general: {
      icon: '⚠️',
      defaultTitle: '出错了',
      defaultDescription: '发生了一些错误'
    }
  };

  const config = configs[type];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {/* Icon */}
      <div 
        className="text-6xl mb-4"
        style={{ 
          fontSize: '64px',
          lineHeight: '64px',
          opacity: 0.6
        }}
      >
        {config.icon}
      </div>

      {/* Title */}
      <h3 
        className="text-xl mb-2"
        style={{ 
          color: '#0F172A',
          fontWeight: 600
        }}
      >
        {title || config.defaultTitle}
      </h3>

      {/* Description */}
      <p 
        className="text-base mb-6 text-center max-w-sm"
        style={{ color: '#64748B' }}
      >
        {description || config.defaultDescription}
      </p>

      {/* Retry Button */}
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg transition-all text-sm"
          style={{
            background: '#3B82F6',
            color: '#FFFFFF',
            fontWeight: 500
          }}
        >
          <RefreshCw className="w-4 h-4" />
          {retryLabel}
        </button>
      )}
    </div>
  );
}
