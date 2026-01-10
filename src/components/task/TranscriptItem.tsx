import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Edit2, Check, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import type { TranscriptWord } from '@/types/api';

interface Speaker {
  name: string;
  color: string;
}

interface TranscriptItemProps {
  speaker: string;
  startTime: string;
  endTime: string;
  content: string;
  words?: TranscriptWord[] | null;
  avatarColor?: string;
  isActive?: boolean;
  activeWordIndex?: number | null;
  activeWordProgress?: number | null;
  onEdit?: (newContent: string) => void;
  onTimeClick?: (time: string) => void;
}

export default function TranscriptItem({
  speaker,
  startTime,
  endTime,
  content,
  words = null,
  avatarColor = 'var(--app-primary)',
  isActive = false,
  activeWordIndex = null,
  activeWordProgress = null,
  onEdit = () => {},
  onTimeClick = () => {}
}: TranscriptItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const { t } = useI18n();

  // 获取说话人首字母
  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditedContent(content);
  };

  const handleSaveEdit = () => {
    onEdit(editedContent);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedContent(content);
    setIsEditing(false);
  };

  const wordSpacing = useMemo(() => {
    if (!words || words.length === 0) return [];
    return words.map((word, index) => {
      const nextWord = words[index + 1]?.word ?? "";
      const endsWithAscii = /[A-Za-z0-9]$/.test(word.word);
      const nextStartsWithAscii = /^[A-Za-z0-9]/.test(nextWord);
      return endsWithAscii && nextStartsWithAscii ? " " : "";
    });
  }, [words]);

  return (
    <div
      className="px-4 py-4 transition-colors cursor-default border-b relative"
      style={{
        background: isEditing
          ? 'var(--app-glass-hover)'
          : isHovered
            ? 'var(--app-glass-hover)'
            : isActive
              ? 'var(--app-primary-soft-2)'
              : 'var(--app-glass-bg)',
        borderColor: isActive ? 'var(--app-primary)' : 'var(--app-glass-border)',
        boxShadow: isActive ? 'inset 3px 0 0 var(--app-primary)' : 'none'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header: Avatar + Speaker + Time + Edit */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg">
            <div
              className="flex items-center justify-center rounded-full text-white text-xs"
              style={{
                width: '28px',
                height: '28px',
                background: avatarColor,
                fontWeight: 600
              }}
            >
              {getInitials(speaker)}
            </div>

            <span className="text-sm" style={{ fontWeight: 500, color: 'var(--app-text)' }}>
              {speaker}
            </span>
          </div>

          {/* Time Range */}
          <button
            onClick={() => onTimeClick(startTime)}
            className="text-xs hover:underline"
            style={{ color: 'var(--app-text-subtle)' }}
          >
            ({startTime} - {endTime})
          </button>
        </div>

        {/* Edit/Save Buttons */}
        {isEditing ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveEdit}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--app-success-bg)] transition-colors"
              style={{ color: 'var(--app-success)' }}
            >
              <Check className="w-3.5 h-3.5" />
              <span className="text-xs">{t("common.save")}</span>
            </button>
            <button
              onClick={handleCancelEdit}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--app-danger-bg)] transition-colors"
              style={{ color: 'var(--app-danger)' }}
            >
              <X className="w-3.5 h-3.5" />
              <span className="text-xs">{t("common.cancel")}</span>
            </button>
          </div>
        ) : (
          isHovered && (
            <button
              onClick={handleStartEdit}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--app-glass-hover)] transition-colors"
              style={{ color: 'var(--app-text-muted)' }}
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span className="text-xs">{t("common.edit")}</span>
            </button>
          )
        )}
      </div>

      {/* Content */}
      {isEditing ? (
        <textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          className="glass-control w-full px-3 py-2 rounded-lg text-base leading-relaxed resize-none"
          style={{ 
            color: 'var(--app-text)', 
            lineHeight: '24px',
            borderColor: 'var(--app-primary)',
            minHeight: '100px'
          }}
          autoFocus
        />
      ) : words && words.length > 0 ? (
        <p
          className="text-base leading-relaxed"
          style={{ color: 'var(--app-text)', lineHeight: '24px' }}
        >
          {words.map((word, index) => {
            const isActiveWord = isActive && activeWordIndex === index;
            const progress = isActiveWord ? (activeWordProgress ?? 0) : 0;
            const wordStyle = isActiveWord
              ? ({ "--word-progress": `${Math.round(progress * 100)}%` } as CSSProperties)
              : undefined;
            return (
              <span
                key={`${word.word}-${word.start_time}-${index}`}
                className={isActiveWord ? "transcript-word transcript-word-active" : "transcript-word"}
                style={wordStyle}
              >
                {word.word}
                {wordSpacing[index]}
              </span>
            );
          })}
        </p>
      ) : (
        <p
          className="text-base leading-relaxed"
          style={{ color: 'var(--app-text)', lineHeight: '24px' }}
        >
          {content}
        </p>
      )}
    </div>
  );
}
