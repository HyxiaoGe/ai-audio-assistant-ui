import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Sidebar from "./Sidebar";

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));
vi.mock("@/store/user-store", () => ({
  useUserStore: (sel: (s: { isAdmin: boolean }) => unknown) => sel({ isAdmin: false }),
}));
vi.mock("@/store/auth-store", () => ({
  useAuthStore: (sel: (s: { user: { id: string } | null }) => unknown) => sel({ user: { id: "u1" } }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/tasks" }));

describe("Sidebar UX-02", () => {
  it("renders nav items as real links with hrefs", () => {
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "nav.tasks" })).toHaveAttribute("href", "/tasks");
  });

  it("marks the active item with aria-current=page and leaves others unset", () => {
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "nav.tasks" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "nav.overview" })).not.toHaveAttribute("aria-current");
  });

  it("labels the navigation landmark", () => {
    render(<Sidebar />);
    expect(screen.getByRole("navigation", { name: "nav.primary" })).toBeInTheDocument();
  });
});
