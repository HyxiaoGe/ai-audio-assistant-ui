import { FileText } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';

interface TranscriptColumnHeaderProps {
  title: string;
  asrProviderName?: string;
}

export function TranscriptColumnHeader({ title, asrProviderName }: TranscriptColumnHeaderProps) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2 px-4 py-4 border-b" style={{ borderColor: 'var(--app-glass-border)' }}>
      <FileText className="w-5 h-5" style={{ color: 'var(--app-text)' }} />
      <h2 className="text-base" style={{ fontWeight: 600, color: 'var(--app-text)' }}>
        {title}
      </h2>
      {asrProviderName && (
        <span className="text-xs" style={{ color: 'var(--app-text-subtle)' }}>
          {t("task.transcribedByCaption", { provider: asrProviderName })}
        </span>
      )}
    </div>
  );
}
