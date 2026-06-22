import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockClient = vi.hoisted(() => ({
  getServiceStatsOverview: vi.fn(),
  getTaskStatsOverview: vi.fn(),
}));
const i18n = vi.hoisted(() => ({ t: (k: string) => k }));

vi.mock("@/lib/use-api-client", () => ({ useAPIClient: () => mockClient }));
vi.mock("@/lib/i18n-context", () => ({ useI18n: () => ({ locale: "zh", t: i18n.t }) }));
vi.mock("@/store/auth-store", () => ({
  useAuthStore: (sel: (s: { user: { id: string } | null }) => unknown) => sel({ user: { id: "u1" } }),
}));
vi.mock("@/store/ui-store", () => ({
  useUIStore: (sel: (s: { openLogin: () => void }) => unknown) => sel({ openLogin: vi.fn() }),
}));

import Stats from "./Stats";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Stats 首屏轻量骨架", () => {
  it("首屏加载(无数据)在任务面板渲染骨架占位", async () => {
    mockClient.getServiceStatsOverview.mockReturnValue(new Promise(() => {})); // pending
    mockClient.getTaskStatsOverview.mockReturnValue(new Promise(() => {}));
    render(<Stats />);
    expect((await screen.findAllByTestId("stats-skeleton")).length).toBeGreaterThan(0);
  });
});
