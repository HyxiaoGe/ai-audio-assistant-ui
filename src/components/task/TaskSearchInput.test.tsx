import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TaskSearchInput } from "./TaskSearchInput";

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

describe("TaskSearchInput a11y", () => {
  it("exposes the search input with a programmatic accessible name", () => {
    render(<TaskSearchInput value="" onChange={vi.fn()} />);
    // 名称来自 aria-label，而非仅 placeholder（placeholder 对读屏不可靠）
    expect(
      screen.getByRole("textbox", { name: "tasks.searchPlaceholder" })
    ).toBeInTheDocument();
  });

  it("renders no clear button while the query is empty", () => {
    render(<TaskSearchInput value="" onChange={vi.fn()} />);
    expect(
      screen.queryByRole("button", { name: "tasks.clearSearch" })
    ).toBeNull();
  });

  it("exposes a named clear button that clears the query", () => {
    const onChange = vi.fn();
    render(<TaskSearchInput value="meeting" onChange={onChange} />);
    fireEvent.click(
      screen.getByRole("button", { name: "tasks.clearSearch" })
    );
    expect(onChange).toHaveBeenCalledWith("");
  });
});
