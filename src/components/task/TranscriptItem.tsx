import { useState } from 'react';
import { Edit2, Check, X, ChevronDown } from 'lucide-react';

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
  avatarColor = '#3B82F6',
  availableSpeakers = [],
  onEdit = () => {},
  onTimeClick = () => {},
  onSpeakerChange = () => {}
}: TranscriptItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [showSpeakerMenu, setShowSpeakerMenu] = useState(false);

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
        background: isHovered || isEditing ? '#F8FAFC' : '#FFFFFF',
        borderColor: '#F1F5F9'
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
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors group"
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
              <span className="text-sm" style={{ fontWeight: 500, color: '#0F172A' }}>
                {speaker}
              </span>

              {/* Dropdown indicator */}
              <ChevronDown 
                className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" 
                style={{ color: '#94A3B8' }}
              />
            </button>

            {/* Speaker Selection Menu */}
            {showSpeakerMenu && (
              <div
                className="absolute left-0 top-full mt-1 w-48 rounded-lg shadow-lg border overflow-hidden z-20"
                style={{ background: '#FFFFFF', borderColor: '#E2E8F0' }}
                onMouseLeave={() => setShowSpeakerMenu(false)}
              >
                <div className="py-1">
                  <div className="px-3 py-1.5 text-xs" style={{ color: '#94A3B8', fontWeight: 500 }}>
                    选择说话人
                  </div>
                  {availableSpeakers.map((spk, index) => (
                    <button
                      key={index}
                      onClick={() => handleSpeakerSelect(spk.name, spk.color)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors"
                      style={{
                        background: spk.name === speaker ? '#F8FAFC' : 'transparent'
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
                      <span className="text-sm" style={{ color: '#0F172A' }}>
                        {spk.name}
                      </span>
                      {spk.name === speaker && (
                        <Check className="w-3.5 h-3.5 ml-auto" style={{ color: '#3B82F6' }} />
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
            style={{ color: '#94A3B8' }}
          >
            ({startTime} - {endTime})
          </button>
        </div>

        {/* Edit/Save Buttons */}
        {isEditing ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveEdit}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-green-100 transition-colors"
              style={{ color: '#10B981' }}
            >
              <Check className="w-3.5 h-3.5" />
              <span className="text-xs">保存</span>
            </button>
            <button
              onClick={handleCancelEdit}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-red-100 transition-colors"
              style={{ color: '#EF4444' }}
            >
              <X className="w-3.5 h-3.5" />
              <span className="text-xs">取消</span>
            </button>
          </div>
        ) : (
          isHovered && (
            <button
              onClick={handleStartEdit}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
              style={{ color: '#64748B' }}
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span className="text-xs">编辑</span>
            </button>
          )
        )}
      </div>

      {/* Content */}
      {isEditing ? (
        <textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg text-base leading-relaxed resize-none"
          style={{ 
            color: '#0F172A', 
            lineHeight: '24px',
            borderColor: '#3B82F6',
            minHeight: '100px'
          }}
          autoFocus
        />
      ) : (
        <p
          className="text-base leading-relaxed"
          style={{ color: '#0F172A', lineHeight: '24px' }}
        >
          {content}
        </p>
      )}
    </div>
  );
}
