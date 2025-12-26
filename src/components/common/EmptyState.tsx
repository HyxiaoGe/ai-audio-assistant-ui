import { Inbox, SearchX } from 'lucide-react';
import { getTheme, Theme } from '@/styles/theme-config';

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
  theme?: Theme;
}

export default function EmptyState({
  variant = 'default',
  icon,
  title,
  description,
  action,
  theme = 'light'
}: EmptyStateProps) {
  const colors = getTheme(theme);
  
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
      color: '#CBD5E1'
    };

    if (variant === 'search') {
      return <SearchX className="mb-5" style={iconStyle} />;
    }

    return <Inbox className="mb-5" style={iconStyle} />;
  };

  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border"
      style={{
        minHeight: '320px',
        background: variant === 'default' 
          ? (theme === 'light' ? '#F8FAFC' : colors.bg.secondary)
          : colors.bg.secondary,
        borderColor: colors.border.default,
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
          color: colors.text.secondary,
          fontWeight: 600
        }}
      >
        {title}
      </h3>

      {/* Description */}
      <p 
        className="text-sm text-center mb-6"
        style={{ 
          color: colors.text.tertiary,
          maxWidth: '280px'
        }}
      >
        {description}
      </p>

      {/* Action Button */}
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-3 rounded-lg transition-all text-sm"
          style={{
            background: action.variant === 'secondary' 
              ? colors.bg.secondary 
              : colors.brand.primary,
            color: action.variant === 'secondary' 
              ? colors.text.primary 
              : colors.text.inverse,
            fontWeight: 500,
            border: action.variant === 'secondary' 
              ? `1px solid ${colors.border.default}` 
              : 'none'
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
