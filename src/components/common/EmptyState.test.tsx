import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EmptyState from "@/components/common/EmptyState";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(
      <EmptyState
        title="No items"
        description="Create your first item"
      />
    );

    expect(screen.getByText("No items")).toBeInTheDocument();
    expect(screen.getByText("Create your first item")).toBeInTheDocument();
  });

  it("renders action button and handles click", () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="No results"
        description="Try a different filter"
        action={{ label: "Retry", onClick }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
