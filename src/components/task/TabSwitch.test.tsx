import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TabSwitch from "@/components/task/TabSwitch";

describe("TabSwitch", () => {
  it("renders tabs and highlights the active one", () => {
    render(
      <TabSwitch
        tabs={[
          { id: "summary", label: "Summary" },
          { id: "transcript", label: "Transcript" },
        ]}
        activeTab="summary"
        onTabChange={() => {}}
      />
    );

    expect(screen.getByRole("tab", { name: "Summary" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Transcript" })).toBeInTheDocument();
  });

  it("calls onTabChange when a tab is clicked", () => {
    const onTabChange = vi.fn();
    render(
      <TabSwitch
        tabs={[
          { id: "summary", label: "Summary" },
          { id: "transcript", label: "Transcript" },
        ]}
        activeTab="summary"
        onTabChange={onTabChange}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Transcript" }));
    expect(onTabChange).toHaveBeenCalledWith("transcript");
  });
});

// audit a11y #13/#14：标签切换原为一组裸 <button>，缺 tablist/tab/aria-selected 语义，
// 也没有 roving tabindex 与方向键导航。该组件被 TaskDetail 与 NewTaskModal 共用。
const abc = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Bravo" },
  { id: "c", label: "Charlie" },
];

describe("TabSwitch a11y", () => {
  it("exposes tablist/tab roles with aria-selected on the active tab", () => {
    render(<TabSwitch tabs={abc} activeTab="b" onTabChange={vi.fn()} />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    const tabEls = screen.getAllByRole("tab");
    expect(tabEls).toHaveLength(3);
    expect(tabEls[1]).toHaveAttribute("aria-selected", "true");
    expect(tabEls[0]).toHaveAttribute("aria-selected", "false");
    expect(tabEls[1]).toHaveAttribute("type", "button");
  });

  it("uses roving tabindex (only the active tab is in the tab order)", () => {
    render(<TabSwitch tabs={abc} activeTab="b" onTabChange={vi.fn()} />);
    const tabEls = screen.getAllByRole("tab");
    expect(tabEls[1]).toHaveAttribute("tabindex", "0");
    expect(tabEls[0]).toHaveAttribute("tabindex", "-1");
    expect(tabEls[2]).toHaveAttribute("tabindex", "-1");
  });

  it("navigates with Arrow keys and activates + focuses the target tab", () => {
    const onTabChange = vi.fn();
    render(<TabSwitch tabs={abc} activeTab="b" onTabChange={onTabChange} />);
    const tabEls = screen.getAllByRole("tab");

    fireEvent.keyDown(tabEls[1], { key: "ArrowRight" });
    expect(onTabChange).toHaveBeenLastCalledWith("c");
    expect(tabEls[2]).toHaveFocus();

    fireEvent.keyDown(tabEls[1], { key: "ArrowLeft" });
    expect(onTabChange).toHaveBeenLastCalledWith("a");
    expect(tabEls[0]).toHaveFocus();
  });

  it("wraps at the ends and supports Home/End", () => {
    const onTabChange = vi.fn();
    render(<TabSwitch tabs={abc} activeTab="c" onTabChange={onTabChange} />);
    const tabEls = screen.getAllByRole("tab");

    fireEvent.keyDown(tabEls[2], { key: "ArrowRight" });
    expect(onTabChange).toHaveBeenLastCalledWith("a");

    fireEvent.keyDown(tabEls[2], { key: "Home" });
    expect(onTabChange).toHaveBeenLastCalledWith("a");

    fireEvent.keyDown(tabEls[2], { key: "End" });
    expect(onTabChange).toHaveBeenLastCalledWith("c");
  });
});
