import { FileText, Video, Mic } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getTheme, Theme } from '@/styles/theme-config';

interface TaskCardProps {
  id: string;
  title: string;
  duration: string;
  timeAgo: string;
  status: 'completed' | 'processing' | 'failed';
  type?: 'video' | 'audio' | 'file';
  onClick?: () => void;
  theme?: Theme;
}

export default function TaskCard({ 
  title, 
  duration, 
  timeAgo, 
  status, 
  type = 'file',
  onClick,
  theme = 'light'
}: TaskCardProps) {
  const colors = getTheme(theme);
  
  const getIcon = () => {
    switch (type) {
      case 'video':
        return <Video className="w-6 h-6" />;
      case 'audio':
        return <Mic className="w-6 h-6" />;
      default:
        return <FileText className="w-6 h-6" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'processing':
        return '处理中';
      case 'failed':
        return '失败';
    }
  };

  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl p-5 flex items-center justify-between transition-all group"
      style={{
        border: `1px solid ${colors.border.default}`,
        background: colors.bg.secondary
      }}
    >
      {/* 左侧：图标 + 信息 */}
      <div className="flex items-center gap-4">
        {/* 图标 */}
        <div 
          className="w-6 h-6 flex items-center justify-center flex-shrink-0"
          style={{ color: colors.text.tertiary }}
        >
          {getIcon()}
        </div>

        {/* 文字信息 */}
        <div className="text-left">
          {/* 标题 */}
          <div 
            className="text-base mb-1"
            style={{ 
              fontWeight: 500,
              color: colors.text.primary
            }}
          >
            {title}
          </div>
          
          {/* 副信息 */}
          <div 
            className="text-sm"
            style={{ color: colors.text.tertiary }}
          >
            {duration} · {timeAgo}
          </div>
        </div>
      </div>

      {/* 右侧：状态Badge */}
      <div className="flex-shrink-0">
        <Badge variant={status} theme={theme}>
          {getStatusText()}
        </Badge>
      </div>
    </button>
  );
}
