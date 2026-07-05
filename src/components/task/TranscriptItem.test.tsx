import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TranscriptItem from './TranscriptItem';

vi.mock('@/lib/i18n-context', () => ({
  useI18n: () => ({ t: (k: string) => k, locale: 'zh' }),
}));

vi.mock('@/components/task/DiffContent', () => ({
  default: ({ content }: { content: string }) => <span>{content}</span>,
}));

function renderItem(overrides: Partial<React.ComponentProps<typeof TranscriptItem>> = {}) {
  return render(
    <TranscriptItem
      segmentId="s1"
      speaker="Speaker A"
      startTime="00:00"
      endTime="00:02"
      content="Hello world"
      {...overrides}
    />,
  );
}

// ──────────────────────────────────────────────────────────────
// 默认（非只读）行为
// ──────────────────────────────────────────────────────────────
describe('TranscriptItem — default (editable) behaviour', () => {
  it('shows the edit button on hover', () => {
    renderItem();
    const row = screen.getByTestId('transcript-item');
    fireEvent.mouseEnter(row);
    expect(screen.getByText('common.edit')).toBeTruthy();
  });

  it('enters editing mode when the edit button is clicked', () => {
    renderItem();
    const row = screen.getByTestId('transcript-item');
    fireEvent.mouseEnter(row);
    fireEvent.click(screen.getByText('common.edit'));
    expect(screen.getByRole('textbox')).toBeTruthy();
  });
});

// ──────────────────────────────────────────────────────────────
// readOnly 模式
// ──────────────────────────────────────────────────────────────
describe('TranscriptItem — readOnly mode', () => {
  it('does not show the edit button on hover when readOnly=true', () => {
    renderItem({ readOnly: true });
    const row = screen.getByTestId('transcript-item');
    fireEvent.mouseEnter(row);
    expect(screen.queryByText('common.edit')).toBeNull();
  });

  it('does not enter editing mode (no textarea) when readOnly=true', () => {
    renderItem({ readOnly: true });
    const row = screen.getByTestId('transcript-item');
    // hover 后确认 handleStartEdit 不会被调用
    fireEvent.mouseEnter(row);
    // 编辑按钮不存在，自然无法进入编辑态
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByText('common.save')).toBeNull();
    expect(screen.queryByText('common.cancel')).toBeNull();
  });

  it('still renders content and speaker info in readOnly mode', () => {
    renderItem({ readOnly: true });
    expect(screen.getByText('Hello world')).toBeTruthy();
    expect(screen.getByText('Speaker A')).toBeTruthy();
  });

  it('readOnly=false (default) behaves identically to omitting the prop', () => {
    // 不传 readOnly 时，hover 仍然显示编辑按钮
    renderItem({ readOnly: false });
    const row = screen.getByTestId('transcript-item');
    fireEvent.mouseEnter(row);
    expect(screen.getByText('common.edit')).toBeTruthy();
  });
});

// ──────────────────────────────────────────────────────────────
// 编辑徽章:按来源区分「已编辑」vs「AI 已校对」(t mock 回显 key)
// ──────────────────────────────────────────────────────────────
describe('TranscriptItem — edit badge source distinction', () => {
  it('AI 校对(isPolished 且非 manuallyEdited)显 transcript.aiPolished', () => {
    renderItem({ isPolished: true, manuallyEdited: false });
    expect(screen.getByText('transcript.aiPolished', { exact: false })).toBeTruthy();
    expect(screen.queryByText('transcript.edited')).toBeNull();
  });

  it('人工编辑(isPolished 且 manuallyEdited)显 transcript.edited,不显 AI 已校对', () => {
    renderItem({ isPolished: true, manuallyEdited: true });
    expect(screen.getByText('transcript.edited')).toBeTruthy();
    expect(screen.queryByText('transcript.aiPolished', { exact: false })).toBeNull();
  });

  it('未编辑(isPolished=false)不渲染任何编辑徽章', () => {
    renderItem({ isPolished: false });
    expect(screen.queryByText('transcript.aiPolished', { exact: false })).toBeNull();
    expect(screen.queryByText('transcript.edited')).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// 键盘可达性(UX-13)
// ──────────────────────────────────────────────────────────────
describe('TranscriptItem — keyboard accessibility (UX-13)', () => {
  it('编辑按钮始终在 DOM(无需 hover),保证纯键盘可达', () => {
    renderItem(); // 不触发 mouseEnter
    expect(screen.getByText('common.edit')).toBeTruthy();
  });

  it('readOnly 时仍不渲染编辑按钮', () => {
    renderItem({ readOnly: true });
    expect(screen.queryByText('common.edit')).toBeNull();
  });
});
