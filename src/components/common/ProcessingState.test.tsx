import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import ProcessingState from "@/components/common/ProcessingState"
vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

describe("ProcessingState (common)", () => {
  it("renders default step labels when no status is provided", () => {
    render(<ProcessingState progress={5} />)

    expect(screen.getByText("processingState.pending")).toBeInTheDocument()
    expect(screen.getByText("processingState.transcribing")).toBeInTheDocument()
    expect(screen.getByText("processingState.summarizing")).toBeInTheDocument()
  })
})

describe('ProcessingState — 诚实化(无假进度/假计时)', () => {
  it('status=processing 且 progress=30 时不渲染硬编码假计时 2:30/5:00', () => {
    const { container } = render(<ProcessingState status="processing" progress={30} />);
    expect(container.textContent).not.toContain('2:30/5:00');
    expect(container.textContent).not.toContain('2:30');
  });

  it('未传 progress 时不凭空显示 65%', () => {
    const { container } = render(<ProcessingState status="processing" />);
    expect(container.textContent).not.toContain('65%');
  });
});
