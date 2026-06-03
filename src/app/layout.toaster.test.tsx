import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

const sonnerToaster = vi.fn(() => null);
vi.mock("sonner", () => ({
  Toaster: (props: Record<string, unknown>) => sonnerToaster(props),
}));
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark" }),
}));

import { Toaster } from "@/components/ui/sonner";

describe("ui/sonner Toaster", () => {
  it("renders sonner with richColors and closeButton enabled", () => {
    render(<Toaster />);
    expect(sonnerToaster).toHaveBeenCalledTimes(1);
    const props = sonnerToaster.mock.calls[0][0];
    expect(props.richColors).toBe(true);
    expect(props.closeButton).toBe(true);
    expect(props.position).toBe("top-right");
    expect(props.theme).toBe("dark");
  });
});
