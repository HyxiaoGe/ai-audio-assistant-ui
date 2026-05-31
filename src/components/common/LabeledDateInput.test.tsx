import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LabeledDateInput } from "./LabeledDateInput";

describe("LabeledDateInput a11y", () => {
  it("associates the visible label with the date input via htmlFor/id", () => {
    render(
      <LabeledDateInput
        id="stats-start"
        label="Start date"
        value="2026-01-01"
        onChange={vi.fn()}
      />
    );
    const input = screen.getByLabelText("Start date");
    expect(input).toHaveAttribute("type", "date");
    expect(input).toHaveValue("2026-01-01");
  });

  it("reports value changes", () => {
    const onChange = vi.fn();
    render(
      <LabeledDateInput id="stats-end" label="End date" value="" onChange={onChange} />
    );
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2026-02-02" },
    });
    expect(onChange).toHaveBeenCalledWith("2026-02-02");
  });
});
