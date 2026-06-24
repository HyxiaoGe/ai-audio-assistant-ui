import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { NotificationSettingsCard } from "./NotificationSettingsCard"
import { defaultNotificationPreferences } from "@/lib/notification-preferences"
import type { UserPreferencesNotifications } from "@/types/api"

const t = (k: string) => k

function renderCard(prefs: UserPreferencesNotifications, overrides?: Partial<{ onChangeMaster: (on: boolean) => void; onChangeType: (key: string, on: boolean) => void }>) {
  const onChangeMaster = vi.fn()
  const onChangeType = vi.fn()
  render(
    <NotificationSettingsCard
      prefs={prefs}
      onChangeMaster={overrides?.onChangeMaster ?? onChangeMaster}
      onChangeType={(overrides?.onChangeType as (key: import("@/types/api").NotificationTypeKey, on: boolean) => void) ?? onChangeType}
      t={t}
    />,
  )
  return { onChangeMaster, onChangeType }
}

describe("NotificationSettingsCard", () => {
  it("总开关开:5 个类型分项可用(共 6 个 switch)", () => {
    renderCard(defaultNotificationPreferences())
    expect(screen.getAllByRole("switch")).toHaveLength(6)
    expect(screen.getByLabelText("settings.notifType.task_completed")).not.toBeDisabled()
    expect(screen.getByLabelText("settings.notifType.visual_failed")).not.toBeDisabled()
  })

  it("总开关关:5 个类型分项 disabled", () => {
    renderCard({ channels: { in_app: false, feishu: false }, types: {} })
    expect(screen.getByLabelText("settings.notificationsMasterLabel")).not.toBeChecked()
    expect(screen.getByLabelText("settings.notifType.task_completed")).toBeDisabled()
    expect(screen.getByLabelText("settings.notifType.quota_alert")).toBeDisabled()
  })

  it("分项 checked 反映 prefs(显式 false → 不勾,null/未设 → 勾)", () => {
    renderCard({
      channels: { in_app: true, feishu: false },
      types: { task_completed: { in_app: false }, task_failed: { in_app: null } },
    })
    expect(screen.getByLabelText("settings.notifType.task_completed")).not.toBeChecked()
    expect(screen.getByLabelText("settings.notifType.task_failed")).toBeChecked()
    expect(screen.getByLabelText("settings.notifType.visual_failed")).toBeChecked()
  })

  it("切总开关回调 onChangeMaster(取反)", () => {
    const { onChangeMaster } = renderCard(defaultNotificationPreferences())
    fireEvent.click(screen.getByLabelText("settings.notificationsMasterLabel"))
    expect(onChangeMaster).toHaveBeenCalledWith(false)
  })

  it("切某类型回调 onChangeType(key, 取反)", () => {
    const { onChangeType } = renderCard(defaultNotificationPreferences())
    fireEvent.click(screen.getByLabelText("settings.notifType.task_completed"))
    expect(onChangeType).toHaveBeenCalledWith("task_completed", false)
  })

  it("不渲染任何 feishu 控件", () => {
    renderCard(defaultNotificationPreferences())
    expect(screen.queryByText(/feishu/i)).toBeNull()
    expect(screen.queryByText(/飞书/)).toBeNull()
  })

  it("渲染「通知类型」分组小标题(分组面板版式)", () => {
    renderCard(defaultNotificationPreferences())
    expect(screen.getByText("settings.notifTypesTitle")).toBeInTheDocument()
    expect(screen.getByText("settings.notifTypesDesc")).toBeInTheDocument()
  })
})
