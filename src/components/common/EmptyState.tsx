import { Inbox, SearchX } from 'lucide-react';

interface EmptyStateProps {
  variant?: 'default' | 'search'; // 默认空状态 vs 搜索无结果
  icon?: string; // emoji 或使用内置图标
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary'; // 按钮样式
  };
}

export default function EmptyState({
  variant = 'default',
  icon,
  title,
  description,
  action
}: EmptyStateProps) {
  // 根据 variant 选择默认图标
  const renderIcon = () => {
    if (icon) {
      return (
        <div 
          className="text-6xl mb-5"
          style={{ 
            fontSize: '64px',
            lineHeight: '64px',
            opacity: 0.6
          }}
        >
          {icon}
        </div>
      );
    }

    const iconStyle = {
      width: '64px',
      height: '64px',
      color: 'var(--app-text-faint)'
    };

    if (variant === 'search') {
      return <SearchX className="mb-5" style={iconStyle} />;
    }

    return <Inbox className="mb-5" style={iconStyle} />;
  };

  return (
    <div
      className="glass-panel flex flex-col items-center justify-center rounded-xl border border-dashed"
      style={{
        minHeight: '320px',
        borderStyle: variant === 'default' ? 'dashed' : 'solid',
        padding: '48px 24px'
      }}
    >
      {/* Icon */}
      {renderIcon()}

      {/* Title */}
      <h3 
        className="text-lg mb-2"
        style={{ 
          color: 'var(--app-text-strong)',
          fontWeight: 600
        }}
      >
        {title}
      </h3>

      {/* Description */}
      <p 
        className="text-sm text-center mb-6"
        style={{ 
          color: 'var(--app-text-muted)',
          maxWidth: '280px'
        }}
      >
        {description}
      </p>

      {/* Action Button */}
      {action && (
        <button
          onClick={action.onClick}
          className={action.variant === "secondary"
            ? "glass-control px-6 py-3 rounded-lg text-sm"
            : "px-6 py-3 rounded-lg text-sm transition-all"}
          style={{
            background: action.variant === 'secondary' 
              ? undefined
              : 'var(--app-primary)',
            color: action.variant === 'secondary' 
              ? 'var(--app-text)' 
              : 'var(--app-button-primary-text)',
            fontWeight: 500,
            border: action.variant === 'secondary' ? undefined : 'none'
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
