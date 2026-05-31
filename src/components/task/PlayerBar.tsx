import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { seekKeyToTime } from '@/lib/seek-keyboard';

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
  const { t } = useI18n();

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 键盘 seek：方向键 ±5s、PageUp/Down ±10s、Home/End 跳到首尾。非 seek 键不拦截（保留 Tab 导航）。
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const next = seekKeyToTime(e.key, currentTime, duration);
    if (next === null) return;
    e.preventDefault();
    onSeek(next);
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
  const hasValidDuration = duration > 0 && isFinite(duration);
  const progress = hasValidDuration
    ? Math.min(100, Math.max(0, (displayTime / duration) * 100))
    : 0;
  // metadata 加载前 duration 可能是 0/NaN/Infinity：把 slider 的 aria 边界 clamp 到合法区间，
  // 避免读屏宣告成 'NaN'/'Infinity'，也避免 valuenow 超过 valuemax。
  const ariaValueMax = hasValidDuration ? duration : 0;
  const ariaValueNow = Math.min(Math.max(0, displayTime), ariaValueMax);

  return (
    <div 
      className="flex items-center gap-4 w-full rounded-xl px-6 py-4"
      style={{ background: "var(--app-player-bg)" }}
    >
      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={onPlayPause}
        aria-label={isPlaying ? t('player.pause') : t('player.play')}
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
        onKeyDown={handleKeyDown}
        role="slider"
        tabIndex={0}
        aria-label={t('player.seek')}
        aria-valuemin={0}
        aria-valuemax={ariaValueMax}
        aria-valuenow={ariaValueNow}
        aria-valuetext={`${formatTime(displayTime)} / ${formatTime(duration)}`}
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
