import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';

interface TaskDetailHeaderProps {
  title: string;
  onBack: () => void;
  right?: ReactNode;
  withBackground?: boolean;
}

export function TaskDetailHeader({ title, onBack, right, withBackground = false }: TaskDetailHeaderProps) {
  const { t } = useI18n();
  return (
    <div
      className="flex items-center justify-between px-6 border-b"
      style={{
        height: '64px',
        borderColor: 'var(--app-glass-border)',
        ...(withBackground ? { background: 'var(--app-glass-bg)' } : {}),
      }}
    >
      {/* Left: Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer text-[var(--app-text-muted)] transition-all duration-150 hover:bg-[var(--app-surface-alt)] hover:text-[var(--app-text)] active:scale-95 active:bg-[var(--app-primary-soft)]"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm" style={{ fontWeight: 500 }}>{t("common.back")}</span>
      </button>

      {/* Center: Title */}
      <h1 className="text-xl" style={{ fontWeight: 600, color: 'var(--app-text)' }}>
        {title}
      </h1>

      {/* Right: slot */}
      {right ?? null}
    </div>
  );
}
