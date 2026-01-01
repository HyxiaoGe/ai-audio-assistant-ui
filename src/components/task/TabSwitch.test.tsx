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

    expect(screen.getByRole("button", { name: "Summary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Transcript" })).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "Transcript" }));
    expect(onTabChange).toHaveBeenCalledWith("transcript");
  });
});
