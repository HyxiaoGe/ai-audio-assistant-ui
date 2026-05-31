import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DiffContent from "@/components/task/DiffContent";

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

// "the cat sat" -> "the dog sat" 产生唯一一个 replace 段（cat->dog），
// 这是唯一可交互的切换控件。
describe("DiffContent a11y", () => {
  it("exposes the replace toggle as a keyboard-focusable button", () => {
    render(<DiffContent originalContent="the cat sat" content="the dog sat" />);
    const toggle = screen.getByRole("button");
    expect(toggle).toHaveAttribute("tabindex", "0");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveTextContent("dog");
  });

  it("toggles original/polished text via Enter and Space", () => {
    render(<DiffContent originalContent="the cat sat" content="the dog sat" />);

    expect(screen.getByRole("button")).toHaveTextContent("dog");

    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    expect(screen.getByRole("button")).toHaveTextContent("cat");
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");

    fireEvent.keyDown(screen.getByRole("button"), { key: " " });
    expect(screen.getByRole("button")).toHaveTextContent("dog");
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });

  // 非激活键（Tab / 普通字符）不应触发切换，避免破坏 Tab 导航。
  it("ignores non-activation keys without toggling", () => {
    render(<DiffContent originalContent="the cat sat" content="the dog sat" />);
    const toggle = screen.getByRole("button");

    fireEvent.keyDown(toggle, { key: "Tab" });
    fireEvent.keyDown(toggle, { key: "a" });

    expect(screen.getByRole("button")).toHaveTextContent("dog");
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });

  // 多个 replace 段：每个切换控件的 aria-pressed 状态相互独立（按 segment index 区分）。
  it("keeps aria-pressed state independent across multiple replace toggles", () => {
    render(
      <DiffContent
        originalContent="the cat sat on a mat"
        content="the dog sat on a rug"
      />
    );
    const toggles = screen.getAllByRole("button");
    expect(toggles).toHaveLength(2);
    expect(toggles[0]).toHaveTextContent("dog");
    expect(toggles[1]).toHaveTextContent("rug");

    // 仅切换第二个：第一个保持不变。
    fireEvent.keyDown(toggles[1], { key: "Enter" });
    const after = screen.getAllByRole("button");
    expect(after[0]).toHaveTextContent("dog");
    expect(after[0]).toHaveAttribute("aria-pressed", "false");
    expect(after[1]).toHaveTextContent("mat");
    expect(after[1]).toHaveAttribute("aria-pressed", "true");
  });

  // insert-only 差异不产生可交互切换控件。
  it("renders no toggle for insert-only diffs", () => {
    render(<DiffContent originalContent="the cat" content="the cat sat" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  // 纯 delete 段默认隐藏且不可达：不渲染删除文本，也不暴露任何按钮。
  it("hides pure-delete segments and exposes no toggle for them", () => {
    render(<DiffContent originalContent="the cat sat here" content="the cat sat" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/here/)).toBeNull();
  });
});
