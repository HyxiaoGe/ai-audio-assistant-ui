// 主题配置文件 - 定义浅色和深色模式的所有颜色

export type Theme = 'light' | 'dark';

interface ThemeColors {
  // 背景色
  bg: {
    primary: string;      // 主背景
    secondary: string;    // 次级背景（卡片等）
    tertiary: string;     // 第三级背景（悬停等）
    gradient: string;     // 渐变背景
  };
  
  // 文字色
  text: {
    primary: string;      // 主要文字
    secondary: string;    // 次要文字
    tertiary: string;     // 辅助文字
    disabled: string;     // 禁用文字
    inverse: string;      // 反色文字（用于按钮等）
  };
  
  // 边框色
  border: {
    default: string;      // 默认边框
    hover: string;        // 悬停边框
    focus: string;        // 聚焦边框
  };
  
  // 品牌色（保持一致）
  brand: {
    primary: string;      // 主色
    primaryHover: string; // 主色悬停
    success: string;      // 成功色
    warning: string;      // 警告色
    error: string;        // 错误色
    info: string;         // 信息色
  };
  
  // 状态色
  status: {
    completed: string;    // 已完成
    processing: string;   // 处理中
    failed: string;       // 失败
  };
  
  // 交互色
  interactive: {
    hover: string;        // 悬停背景
    active: string;       // 激活背景
    selected: string;     // 选中背景
  };
  
  // 阴影
  shadow: {
    sm: string;
    md: string;
    lg: string;
  };
}

// 浅色主题配置
export const lightTheme: ThemeColors = {
  bg: {
    primary: '#FFFFFF',
    secondary: '#FFFFFF',
    tertiary: '#F8FAFC',
    gradient: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',
  },
  
  text: {
    primary: '#0F172A',
    secondary: '#475569',
    tertiary: '#64748B',
    disabled: '#94A3B8',
    inverse: '#FFFFFF',
  },
  
  border: {
    default: '#E2E8F0',
    hover: '#CBD5E1',
    focus: '#3B82F6',
  },
  
  brand: {
    primary: '#3B82F6',
    primaryHover: '#2563EB',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
  
  status: {
    completed: '#10B981',
    processing: '#3B82F6',
    failed: '#EF4444',
  },
  
  interactive: {
    hover: '#F8FAFC',
    active: '#F1F5F9',
    selected: '#EFF6FF',
  },
  
  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  },
};

// 深色主题配置
export const darkTheme: ThemeColors = {
  bg: {
    primary: '#0F172A',       // 深蓝黑色
    secondary: '#1E293B',     // 稍浅的卡片背景
    tertiary: '#334155',      // 第三级背景
    gradient: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
  },
  
  text: {
    primary: '#F1F5F9',       // 浅色主文字
    secondary: '#CBD5E1',     // 次要文字
    tertiary: '#94A3B8',      // 辅助文字
    disabled: '#64748B',      // 禁用文字
    inverse: '#0F172A',       // 反色文字
  },
  
  border: {
    default: '#334155',
    hover: '#475569',
    focus: '#3B82F6',
  },
  
  brand: {
    primary: '#3B82F6',
    primaryHover: '#2563EB',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
  
  status: {
    completed: '#10B981',
    processing: '#3B82F6',
    failed: '#EF4444',
  },
  
  interactive: {
    hover: '#1E293B',
    active: '#334155',
    selected: '#1E3A5F',      // 深蓝色选中态
  },
  
  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.4)',
  },
};

// 获取主题配置的工具函数
export function getTheme(theme: Theme): ThemeColors {
  return theme === 'dark' ? darkTheme : lightTheme;
}

// 辅助函数：获取特定主题的颜色
export function getColor(theme: Theme, path: string): string {
  const colors = getTheme(theme);
  const keys = path.split('.');
  let value: unknown = colors;
  
  for (const key of keys) {
    if (typeof value !== "object" || value === null) {
      return '';
    }
    const record = value as Record<string, unknown>;
    if (!(key in record)) {
      return '';
    }
    value = record[key];
  }
  
  return typeof value === "string" ? value : "";
}
