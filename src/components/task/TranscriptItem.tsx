import { useState } from 'react';
import { Edit2, Check, X, ChevronDown } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';

interface Speaker {
  name: string;
  color: string;
}

interface TranscriptItemProps {
  speaker: string;
  startTime: string;
  endTime: string;
  content: string;
  avatarColor?: string;
  availableSpeakers?: Speaker[];
  onEdit?: (newContent: string) => void;
  onTimeClick?: (time: string) => void;
  onSpeakerChange?: (newSpeaker: string, newColor: string) => void;
}

export default function TranscriptItem({
  speaker,
  startTime,
  endTime,
  content,
  avatarColor = 'var(--app-primary)',
  availableSpeakers = [],
  onEdit = () => {},
  onTimeClick = () => {},
  onSpeakerChange = () => {}
}: TranscriptItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [showSpeakerMenu, setShowSpeakerMenu] = useState(false);
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

  const handleSpeakerSelect = (newSpeaker: string, newColor: string) => {
    onSpeakerChange(newSpeaker, newColor);
    setShowSpeakerMenu(false);
  };

  return (
    <div
      className="px-4 py-4 transition-colors cursor-default border-b relative"
      style={{
        background: isHovered || isEditing ? 'var(--app-glass-hover)' : 'var(--app-glass-bg)',
        borderColor: 'var(--app-glass-border)'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header: Avatar + Speaker + Time + Edit */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Avatar - Clickable to change speaker */}
          <div className="relative">
            <button
              onClick={() => setShowSpeakerMenu(!showSpeakerMenu)}
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[var(--app-glass-hover)] transition-colors group"
            >
              <div
                className="flex items-center justify-center rounded-full text-white text-xs ring-2 ring-transparent group-hover:ring-gray-300 transition-all"
                style={{
                  width: '28px',
                  height: '28px',
                  background: avatarColor,
                  fontWeight: 600
                }}
              >
                {getInitials(speaker)}
              </div>

              {/* Speaker Name */}
              <span className="text-sm" style={{ fontWeight: 500, color: 'var(--app-text)' }}>
                {speaker}
              </span>

              {/* Dropdown indicator */}
              <ChevronDown 
                className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" 
                style={{ color: 'var(--app-text-subtle)' }}
              />
            </button>

            {/* Speaker Selection Menu */}
            {showSpeakerMenu && (
              <div
                className="glass-panel-strong absolute left-0 top-full mt-1 w-48 rounded-lg border overflow-hidden z-20"
                style={{ borderColor: 'var(--app-glass-border)' }}
                onMouseLeave={() => setShowSpeakerMenu(false)}
              >
                <div className="py-1">
                  <div className="px-3 py-1.5 text-xs" style={{ color: 'var(--app-text-subtle)', fontWeight: 500 }}>
                    {t("transcript.selectSpeaker")}
                  </div>
                  {availableSpeakers.map((spk, index) => (
                    <button
                      key={index}
                      onClick={() => handleSpeakerSelect(spk.name, spk.color)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--app-glass-hover)] transition-colors"
                      style={{
                        background: spk.name === speaker ? 'var(--app-glass-bg-strong)' : 'transparent'
                      }}
                    >
                      <div
                        className="flex items-center justify-center rounded-full text-white text-xs"
                        style={{
                          width: '24px',
                          height: '24px',
                          background: spk.color,
                          fontWeight: 600
                        }}
                      >
                        {getInitials(spk.name)}
                      </div>
                      <span className="text-sm" style={{ color: 'var(--app-text)' }}>
                        {spk.name}
                      </span>
                      {spk.name === speaker && (
                        <Check className="w-3.5 h-3.5 ml-auto" style={{ color: 'var(--app-primary)' }} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
