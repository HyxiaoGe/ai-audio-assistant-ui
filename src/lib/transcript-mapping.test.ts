import { describe, expect, it } from 'vitest';
import { mapApiTranscript, formatTimestamp, SPEAKER_PALETTE_COLORS, UNKNOWN_SPEAKER_COLOR } from './transcript-mapping';
import type { TranscriptSegment as ApiTranscriptSegment } from '@/types/api';

// ──────────────────────────────────────────────────────────────
// formatTimestamp
// ──────────────────────────────────────────────────────────────
describe('formatTimestamp', () => {
  it('formats 0 seconds as 00:00', () => {
    expect(formatTimestamp(0)).toBe('00:00');
  });

  it('formats 65.7 seconds as 01:05 (floors sub-seconds)', () => {
    expect(formatTimestamp(65.7)).toBe('01:05');
  });

  it('formats 3600 seconds as 60:00', () => {
    expect(formatTimestamp(3600)).toBe('60:00');
  });

  it('pads minutes and seconds with leading zero', () => {
    expect(formatTimestamp(9)).toBe('00:09');
    expect(formatTimestamp(61)).toBe('01:01');
  });
});

// ──────────────────────────────────────────────────────────────
// Helper fixtures
// ──────────────────────────────────────────────────────────────
function seg(
  id: string,
  speakerId: string | null,
  overrides?: Partial<ApiTranscriptSegment>,
): ApiTranscriptSegment {
  return {
    id,
    speaker_id: speakerId,
    speaker_label: speakerId ?? null,
    content: `content of ${id}`,
    start_time: 0,
    end_time: 2,
    confidence: null,
    words: null,
    sequence: 0,
    is_edited: false,
    original_content: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

const SPEAKER_LABELS = [
  { name: 'A', color: SPEAKER_PALETTE_COLORS[0] },
  { name: 'B', color: SPEAKER_PALETTE_COLORS[1] },
  { name: 'C', color: SPEAKER_PALETTE_COLORS[2] },
  { name: 'D', color: SPEAKER_PALETTE_COLORS[3] },
  { name: 'E', color: SPEAKER_PALETTE_COLORS[4] },
  { name: '未知', color: UNKNOWN_SPEAKER_COLOR },
];
const UNKNOWN_LABEL = '未知';

// ──────────────────────────────────────────────────────────────
// mapApiTranscript — 字段映射
// ──────────────────────────────────────────────────────────────
describe('mapApiTranscript — field mapping', () => {
  it('maps id, content, startTime, endTime, startSeconds, endSeconds correctly', () => {
    const items = [seg('seg1', null, { start_time: 65, end_time: 130, content: 'hello' })];
    const result = mapApiTranscript(items, SPEAKER_LABELS, UNKNOWN_LABEL);

    expect(result).toHaveLength(1);
    const r = result[0];
    expect(r.id).toBe('seg1');
    expect(r.content).toBe('hello');
    expect(r.startTime).toBe('01:05');
    expect(r.endTime).toBe('02:10');
    expect(r.startSeconds).toBe(65);
    expect(r.endSeconds).toBe(130);
  });

  it('maps isPolished from is_edited', () => {
    const items = [seg('s1', null, { is_edited: true })];
    expect(mapApiTranscript(items, SPEAKER_LABELS, UNKNOWN_LABEL)[0].isPolished).toBe(true);
  });

  it('maps originalContent from original_content', () => {
    const items = [seg('s1', null, { original_content: 'orig' })];
    expect(mapApiTranscript(items, SPEAKER_LABELS, UNKNOWN_LABEL)[0].originalContent).toBe('orig');
  });

  it('maps words field directly (null when absent)', () => {
    const wordList = [{ word: 'hi', start_time: 0, end_time: 1, confidence: null }];
    const withWords = seg('s1', null, { words: wordList });
    const withNull = seg('s2', null, { words: null });
    const results = mapApiTranscript([withWords, withNull], SPEAKER_LABELS, UNKNOWN_LABEL);
    expect(results[0].words).toEqual(wordList);
    expect(results[1].words).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// mapApiTranscript — speaker palette assignment
// ──────────────────────────────────────────────────────────────
describe('mapApiTranscript — speaker palette assignment', () => {
  it('assigns colors in first-appearance order', () => {
    const items = [
      seg('s1', 'spk_A'),
      seg('s2', 'spk_B'),
      seg('s3', 'spk_A'), // 重复出现，仍用第一次的色
    ];
    const result = mapApiTranscript(items, SPEAKER_LABELS, UNKNOWN_LABEL);

    expect(result[0].avatarColor).toBe(SPEAKER_PALETTE_COLORS[0]); // spk_A → color[0]
    expect(result[1].avatarColor).toBe(SPEAKER_PALETTE_COLORS[1]); // spk_B → color[1]
    expect(result[2].avatarColor).toBe(SPEAKER_PALETTE_COLORS[0]); // spk_A 再出现仍 color[0]
  });

  it('uses unknownSpeaker color when speaker_id is null', () => {
    const items = [seg('s1', null)];
    const result = mapApiTranscript(items, SPEAKER_LABELS, UNKNOWN_LABEL);
    expect(result[0].avatarColor).toBe(UNKNOWN_SPEAKER_COLOR);
    expect(result[0].speaker).toBe(UNKNOWN_LABEL);
  });

  it('cycles palette when more than 5 distinct speakers appear', () => {
    const items = Array.from({ length: 6 }, (_, i) => seg(`s${i}`, `spk_${i}`));
    const result = mapApiTranscript(items, SPEAKER_LABELS, UNKNOWN_LABEL);
    // 6번째 화자는 팔레트를 순환 → color[0]으로 돌아옴
    expect(result[5].avatarColor).toBe(SPEAKER_PALETTE_COLORS[0]);
  });

  it('assigns stable name labels from speakerLabels in order', () => {
    const items = [seg('s1', 'spk_1'), seg('s2', 'spk_2')];
    const result = mapApiTranscript(items, SPEAKER_LABELS, UNKNOWN_LABEL);
    // SPEAKER_LABELS[0].name = 'A', [1].name = 'B'
    expect(result[0].speaker).toBe('A');
    expect(result[1].speaker).toBe('B');
  });

  it('returns empty array for empty input', () => {
    expect(mapApiTranscript([], SPEAKER_LABELS, UNKNOWN_LABEL)).toEqual([]);
  });
});
