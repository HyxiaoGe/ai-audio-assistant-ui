import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChannelSearchInput } from "./ChannelSearchInput";

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

describe("ChannelSearchInput a11y", () => {
  it("renders no clear button while the query is empty", () => {
    render(<ChannelSearchInput value="" onChange={vi.fn()} />);
    expect(
      screen.queryByRole("button", { name: "subscriptions.clearSearch" })
    ).toBeNull();
  });

  it("exposes a named clear button and clears the query on click", () => {
    const onChange = vi.fn();
    render(<ChannelSearchInput value="news" onChange={onChange} />);

    const clear = screen.getByRole("button", {
      name: "subscriptions.clearSearch",
    });
    fireEvent.click(clear);
    expect(onChange).toHaveBeenCalledWith("");
  });
});
