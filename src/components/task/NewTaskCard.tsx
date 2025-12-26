import { Plus } from 'lucide-react';
import { getTheme, Theme } from '@/styles/theme-config';

interface NewTaskCardProps {
  onClick: () => void;
  theme?: Theme;
}

export default function NewTaskCard({ onClick, theme = 'light' }: NewTaskCardProps) {
  const colors = getTheme(theme);
  
  return (
    <button
      onClick={onClick}
      className="w-full h-30 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group hover:border-blue-500"
      style={{
        border: `2px dashed ${colors.border.default}`,
        background: theme === 'light' ? '#F8FAFC' : colors.bg.secondary,
        minHeight: '120px'
      }}
    >
      {/* 加号图标 */}
      <div 
        className="w-8 h-8 flex items-center justify-center transition-colors"
        style={{ color: colors.text.tertiary }}
      >
        <Plus className="w-8 h-8" style={{ color: colors.text.tertiary }} />
      </div>
      
      {/* 文字 */}
      <span 
        className="text-lg transition-colors"
        style={{ 
          fontWeight: 500,
          color: colors.text.tertiary
        }}
      >
        新建任务
      </span>
    </button>
  );
}
