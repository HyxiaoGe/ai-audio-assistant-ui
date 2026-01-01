import { Plus } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';

interface NewTaskCardProps {
  onClick: () => void;
}

export default function NewTaskCard({ onClick }: NewTaskCardProps) {
  const { t } = useI18n();
  
  return (
    <button
      onClick={onClick}
      className="glass-panel w-full h-30 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group border-2 border-dashed hover:border-[var(--app-primary)]"
      style={{
        borderColor: "var(--app-glass-border)",
        background: "var(--app-glass-bg)",
        minHeight: '120px'
      }}
    >
      {/* 加号图标 */}
      <div 
        className="w-8 h-8 flex items-center justify-center transition-colors"
        style={{ color: "var(--app-text-muted)" }}
      >
        <Plus className="w-8 h-8" style={{ color: "var(--app-text-muted)" }} />
      </div>
      
      {/* 文字 */}
      <span 
        className="text-lg transition-colors"
        style={{ 
          fontWeight: 500,
          color: "var(--app-text-muted)"
        }}
      >
        {t("task.newTask")}
      </span>
    </button>
  );
}
