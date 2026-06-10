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
    const { container } = renderItem();
    const row = container.querySelector('div.px-4.py-4') as HTMLElement;
    fireEvent.mouseEnter(row);
    expect(screen.getByText('common.edit')).toBeTruthy();
  });

  it('enters editing mode when the edit button is clicked', () => {
    const { container } = renderItem();
    const row = container.querySelector('div.px-4.py-4') as HTMLElement;
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
    const { container } = renderItem({ readOnly: true });
    const row = container.querySelector('div.px-4.py-4') as HTMLElement;
    fireEvent.mouseEnter(row);
    expect(screen.queryByText('common.edit')).toBeNull();
  });

  it('does not enter editing mode (no textarea) when readOnly=true', () => {
    const { container } = renderItem({ readOnly: true });
    const row = container.querySelector('div.px-4.py-4') as HTMLElement;
    // hover してから手動で handleStartEdit が呼ばれないことを確認
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
    const { container } = renderItem({ readOnly: false });
    const row = container.querySelector('div.px-4.py-4') as HTMLElement;
    fireEvent.mouseEnter(row);
    expect(screen.getByText('common.edit')).toBeTruthy();
  });
});
