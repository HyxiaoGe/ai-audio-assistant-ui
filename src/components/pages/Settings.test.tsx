import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

const mockClient = vi.hoisted(() => ({
  getUserPreferences: vi.fn(),
  updateUserPreferences: vi.fn(),
  getAsrFreeQuota: vi.fn(),
  getTaskStatsOverview: vi.fn(),
}));
const settingsCtx = vi.hoisted(() => ({
  setLocale: vi.fn(),
  setTheme: vi.fn(),
  setTimeZone: vi.fn(),
  setHourCycle: vi.fn(),
}));
const notify = vi.hoisted(() => ({ notifyInfo: vi.fn(), notifyError: vi.fn() }));
const authState = vi.hoisted(() => ({ user: { id: "u1" } as { id: string } | null }));

// Mock Radix UI Select 为原生 <select> 以绕过 jsdom 的 pointer 事件限制
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value?: string; onValueChange?: (v: string) => void; children?: React.ReactNode }) => (
    <select role="combobox" value={value} onChange={(e) => onValueChange?.(e.target.value)}>{children}</select>
  ),
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <>{placeholder}</>,
  SelectContent: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children?: React.ReactNode }) => <option value={value}>{children}</option>,
  SelectGroup: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  SelectLabel: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  SelectSeparator: () => null,
}));
vi.mock("@/lib/use-api-client", () => ({ useAPIClient: () => mockClient }));
vi.mock("@/lib/i18n-context", () => ({ useI18n: () => ({ locale: "zh", t: (k: string) => k }) }));
vi.mock("@/lib/settings-context", () => ({
  useSettings: () => ({
    locale: "zh-CN", theme: "system", timeZone: "auto", hourCycle: "auto",
    setLocale: settingsCtx.setLocale, setTheme: settingsCtx.setTheme,
    setTimeZone: settingsCtx.setTimeZone, setHourCycle: settingsCtx.setHourCycle,
  }),
}));
vi.mock("@/lib/notify", () => ({ notifyInfo: notify.notifyInfo, notifyError: notify.notifyError }));
vi.mock("@/store/auth-store", () => ({
  useAuthStore: (sel: (s: { user: { id: string } | null }) => unknown) => sel({ user: authState.user }),
}));
vi.mock("@/store/user-store", () => ({
  useUserStore: (sel: (s: { isAdmin: boolean }) => unknown) => sel({ isAdmin: true }),
}));

import Settings from "./Settings";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  authState.user = { id: "u1" };
  mockClient.getUserPreferences.mockResolvedValue({ task_defaults: {}, ui: {}, notifications: {} });
  mockClient.updateUserPreferences.mockResolvedValue({ task_defaults: {}, ui: {}, notifications: {} });
  mockClient.getTaskStatsOverview.mockResolvedValue({ total_tasks: 0, total_audio_duration_formatted: "0:00" });
  mockClient.getAsrFreeQuota.mockResolvedValue({});
});

describe("UX-10 安慰剂控件删除", () => {
  it("不再渲染 Notification 卡(邮件/推送开关)", () => {
    render(<Settings />);
    expect(screen.queryByText("settings.notificationsTitle")).toBeNull();
    expect(screen.queryByText("settings.emailNotifications")).toBeNull();
    expect(screen.queryByText("settings.pushNotifications")).toBeNull();
  });

  it("不再渲染摘要详细度控件", () => {
    render(<Settings />);
    expect(screen.queryByText("settings.summaryDetail")).toBeNull();
  });

  it("处理设置卡仍保留默认语言与说话人分离(真生效控件)", () => {
    render(<Settings />);
    expect(screen.getByText("settings.defaultLanguage")).toBeInTheDocument();
    expect(screen.getByText("settings.speakerDiarization")).toBeInTheDocument();
  });
});

describe("UX-10 保存按钮三态", () => {
  it("成功:点保存经 saving 到「已保存」,并应用本地外观", async () => {
    mockClient.updateUserPreferences.mockResolvedValue({ task_defaults: {}, ui: {}, notifications: {} });
    render(<Settings />);
    fireEvent.click(screen.getByRole("button", { name: /settings\.saveAction$/ }));
    expect(await screen.findByText("common.saved")).toBeInTheDocument();
    expect(settingsCtx.setLocale).toHaveBeenCalled();
    expect(settingsCtx.setTheme).toHaveBeenCalled();
    expect(mockClient.updateUserPreferences).toHaveBeenCalledTimes(1);
  });

  it("失败:点保存到「保存失败」,按钮可重试,且 notifyError 一次", async () => {
    mockClient.updateUserPreferences.mockRejectedValue(new Error("boom"));
    render(<Settings />);
    fireEvent.click(screen.getByRole("button", { name: /settings\.saveAction$/ }));
    const failBtn = await screen.findByRole("button", { name: /settings\.saveActionFailed/ });
    expect(failBtn).not.toBeDisabled();
    await waitFor(() => expect(notify.notifyError).toHaveBeenCalledTimes(1));
  });

  it("未登录:点保存显示「已保存」且不调用 updateUserPreferences", async () => {
    authState.user = null;
    render(<Settings />);
    fireEvent.click(screen.getByRole("button", { name: /settings\.saveAction$/ }));
    expect(await screen.findByText("common.saved")).toBeInTheDocument();
    expect(mockClient.updateUserPreferences).not.toHaveBeenCalled();
  });
});
