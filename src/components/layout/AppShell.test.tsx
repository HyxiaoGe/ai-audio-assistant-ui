import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppShell from "./AppShell";
import { useUIStore } from "@/store/ui-store";

vi.mock("@/components/layout/Header", () => ({
  default: () => <header role="banner">header</header>,
}));
vi.mock("@/components/layout/Sidebar", () => ({
  default: () => <nav aria-label="primary">sidebar</nav>,
}));
vi.mock("@/components/auth/LoginModal", () => ({
  default: ({ isOpen, callbackUrl }: { isOpen: boolean; callbackUrl?: string }) =>
    isOpen ? <div data-testid="login-modal" data-callback={callbackUrl} /> : null,
}));
vi.mock("@/components/task/NewTaskModal", () => ({
  default: ({ isOpen, initialYouTubeVideoId }: { isOpen: boolean; initialYouTubeVideoId?: string }) =>
    isOpen ? <div data-testid="new-task-modal" data-video-id={initialYouTubeVideoId ?? ""} /> : null,
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/tasks" }));

beforeEach(() => {
  useUIStore.setState({ loginOpen: false, newTaskOpen: false, newTaskInitial: undefined });
});

describe("AppShell", () => {
  it("renders one banner, one nav, and the children inside main", () => {
    render(<AppShell><div data-testid="page-child" /></AppShell>);
    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(screen.getByRole("navigation", { name: "primary" })).toBeInTheDocument();
    expect(screen.getByTestId("page-child").closest("main")).not.toBeNull();
  });

  it("opens the login modal with the current pathname as callbackUrl", () => {
    render(<AppShell><div /></AppShell>);
    expect(screen.queryByTestId("login-modal")).toBeNull();
    act(() => useUIStore.getState().openLogin());
    expect(screen.getByTestId("login-modal")).toHaveAttribute("data-callback", "/tasks");
  });

  it("passes the new-task initial video context to NewTaskModal", () => {
    render(<AppShell><div /></AppShell>);
    act(() => useUIStore.getState().openNewTask({ initialYouTubeVideoId: "vid-9" }));
    expect(screen.getByTestId("new-task-modal")).toHaveAttribute("data-video-id", "vid-9");
  });
});
