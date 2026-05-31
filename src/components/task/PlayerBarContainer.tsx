import type { ComponentProps } from 'react';
import { useAudioStore } from '@/store/audio-store';
import PlayerBar from '@/components/task/PlayerBar';
import YouTubePlayerCard from '@/components/task/YouTubePlayerCard';

interface PlayerBarContainerProps {
  isActiveAudio: boolean;
  duration: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  youtube?: {
    youtubeInfo: ComponentProps<typeof YouTubePlayerCard>['youtubeInfo'];
    sourceUrl?: string;
  } | null;
}

/**
 * 播放器容器。
 *
 * 之所以独立成组件：播放进度条是详情页里第二个逐帧 currentTime 订阅者。把它关进这个叶子组件后，
 * 父组件 TaskDetail 不再为了显示进度而每秒重渲染——逐帧重渲染被限制在这个很小的组件内。
 * duration / isPlaying 变化很少，由父组件以 props 传入即可。
 */
export function PlayerBarContainer({
  isActiveAudio,
  duration,
  isPlaying,
  onPlayPause,
  onSeek,
  youtube,
}: PlayerBarContainerProps) {
  const currentTime = useAudioStore((state) => state.currentTime);
  const displayCurrentTime = isActiveAudio ? currentTime : 0;

  if (youtube) {
    return (
      <YouTubePlayerCard
        youtubeInfo={youtube.youtubeInfo}
        sourceUrl={youtube.sourceUrl}
        currentTime={displayCurrentTime}
        duration={duration}
        isPlaying={isPlaying}
        onPlayPause={onPlayPause}
        onSeek={onSeek}
      />
    );
  }

  return (
    <div className="px-6 py-4" style={{ background: 'var(--app-glass-bg)' }}>
      <PlayerBar
        currentTime={displayCurrentTime}
        duration={duration}
        isPlaying={isPlaying}
        onPlayPause={onPlayPause}
        onSeek={onSeek}
      />
    </div>
  );
}
