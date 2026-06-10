/**
 * 转写映射工具函数。
 *
 * 把后端 TranscriptSegment（原始 API 结构）映射为前端展示分段（DisplayTranscriptSegment），
 * 并按出现顺序为每位说话人分配调色板色彩。抽离到此文件供 TaskDetail 与 PublicTaskDetail 共用。
 */

import type { TranscriptSegment as ApiTranscriptSegment, TranscriptWord } from '@/types/api';

/** 前端展示用的转写分段（从后端 TranscriptSegment 映射而来）。 */
export interface DisplayTranscriptSegment {
  id: string;
  speaker: string;
  startTime: string;
  endTime: string;
  startSeconds: number;
  endSeconds: number;
  content: string;
  words: TranscriptWord[] | null;
  avatarColor: string;
  isPolished: boolean;
  originalContent: string | null;
}

/** 说话人调色板（按出现顺序分配，最多 5 个具名色；超出后循环）。 */
export const SPEAKER_PALETTE_COLORS: string[] = [
  'var(--app-primary)',
  'var(--app-success)',
  'var(--app-warning)',
  'var(--app-danger)',
  'var(--app-purple)',
];

/** 未知说话人兜底色。 */
export const UNKNOWN_SPEAKER_COLOR = 'var(--app-text-subtle)';

/** 把秒数格式化为 MM:SS。 */
export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 把后端转写 items 映射为展示分段（含 speaker 调色板按出现顺序分配）。
 *
 * @param items          后端 TranscriptSegment[]
 * @param speakerLabels  说话人调色板（含名称与色彩）——调用方按 i18n 传入
 * @param unknownSpeakerLabel  未知说话人文案（按 i18n 传入，用于兜底与过滤调色板）
 */
export function mapApiTranscript(
  items: ApiTranscriptSegment[],
  speakerLabels: { name: string; color: string }[],
  unknownSpeakerLabel: string,
): DisplayTranscriptSegment[] {
  const speakerPalette = speakerLabels.filter((spk) => spk.name !== unknownSpeakerLabel);
  const speakerMap = new Map<string, { name: string; color: string }>();
  let paletteIndex = 0;

  items.forEach((segment) => {
    const speakerId = segment.speaker_id;
    if (!speakerId) return;
    if (!speakerMap.has(speakerId)) {
      const speakerInfo = speakerPalette[paletteIndex % speakerPalette.length];
      if (speakerInfo) {
        speakerMap.set(speakerId, speakerInfo);
        paletteIndex += 1;
      }
    }
  });

  return items.map((segment) => {
    const speakerInfo = segment.speaker_id ? speakerMap.get(segment.speaker_id) : null;
    return {
      id: segment.id,
      speaker: speakerInfo?.name || unknownSpeakerLabel,
      startTime: formatTimestamp(segment.start_time),
      endTime: formatTimestamp(segment.end_time),
      startSeconds: segment.start_time,
      endSeconds: segment.end_time,
      content: segment.content,
      words: segment.words ?? null,
      avatarColor: speakerInfo?.color || UNKNOWN_SPEAKER_COLOR,
      isPolished: segment.is_edited ?? false,
      originalContent: segment.original_content ?? null,
    };
  });
}
