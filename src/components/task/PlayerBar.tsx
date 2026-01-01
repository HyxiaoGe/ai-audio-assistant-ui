import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';

interface PlayerBarProps {
  currentTime?: number;
  duration: number;
  isPlaying?: boolean;
  onPlayPause?: () => void;
  onSeek?: (time: number) => void;
}

export default function PlayerBar({ 
  currentTime = 0, 
  duration,
  isPlaying = false,
  onPlayPause = () => {},
  onSeek = () => {}
}: PlayerBarProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [localTime, setLocalTime] = useState(currentTime);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const displayTime = isDragging ? localTime : currentTime;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * duration;
    setLocalTime(newTime);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!progressBarRef.current) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const newTime = percentage * duration;
      setLocalTime(newTime);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      onSeek(localTime);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [duration, isDragging, localTime, onSeek]);

  // Guard against invalid duration (0, NaN, Infinity)
  const progress = duration > 0 && isFinite(duration)
    ? Math.min(100, Math.max(0, (displayTime / duration) * 100))
    : 0;

  return (
    <div 
      className="flex items-center gap-4 w-full rounded-xl px-6 py-4"
      style={{ background: "var(--app-player-bg)" }}
    >
      {/* Play/Pause Button */}
      <button
        onClick={onPlayPause}
        className="flex items-center justify-center rounded-full transition-transform hover:scale-105"
        style={{
          width: '48px',
          height: '48px',
          background: "var(--app-player-text)"
        }}
      >
        {isPlaying ? (
          <Pause className="w-6 h-6" style={{ color: "var(--app-player-bg)" }} />
        ) : (
          <Play className="w-6 h-6 ml-1" style={{ color: "var(--app-player-bg)" }} />
        )}
      </button>

      {/* Current Time */}
      <span className="text-sm" style={{ color: "var(--app-player-text-muted)", minWidth: '45px' }}>
        {formatTime(displayTime)}
      </span>

      {/* Progress Bar */}
      <div 
        ref={progressBarRef}
        className="flex-1 relative cursor-pointer"
        onMouseDown={handleMouseDown}
        style={{ height: '32px' }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 w-full">
          {/* Track */}
          <div 
            className="w-full rounded-full"
            style={{ 
              height: '4px',
              background: "var(--app-player-track)"
            }}
          >
            {/* Fill */}
            <div 
              className="h-full rounded-full relative transition-all"
              style={{ 
                width: `${progress}%`,
                background: "var(--app-primary)"
              }}
            >
              {/* Knob */}
              <div
                className="absolute -right-2 top-1/2 -translate-y-1/2 rounded-full transition-transform hover:scale-125"
                style={{
                  width: '16px',
                  height: '16px',
                  background: "var(--app-player-text)",
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Duration */}
      <span className="text-sm" style={{ color: "var(--app-player-text-muted)", minWidth: '45px' }}>
        {formatTime(duration)}
      </span>
    </div>
  );
}
