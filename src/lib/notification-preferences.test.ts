import { describe, it, expect } from "vitest"
import {
  NOTIFICATION_TYPE_KEYS,
  defaultNotificationPreferences,
  normalizeNotificationPreferences,
  isMasterInAppOn,
  isTypeInAppOn,
  setMasterInApp,
  setTypeInApp,
} from "./notification-preferences"

describe("notification-preferences helpers", () => {
  it("NOTIFICATION_TYPE_KEYS 是 5 个后端类型,顺序稳定", () => {
    expect(NOTIFICATION_TYPE_KEYS).toEqual([
      "task_completed",
      "task_failed",
      "quota_alert",
      "youtube_reauth_required",
      "visual_failed",
    ])
  })

  it("defaultNotificationPreferences:总开关开、feishu 关、无类型覆写", () => {
    expect(defaultNotificationPreferences()).toEqual({
      channels: { in_app: true, feishu: false },
      types: {},
    })
  })

  describe("normalizeNotificationPreferences", () => {
    it("干净矩阵透传(含 feishu 与 null)", () => {
      const raw = {
        channels: { in_app: false, feishu: true },
        types: { task_failed: { in_app: null, feishu: true } },
      }
      expect(normalizeNotificationPreferences(raw)).toEqual({
        channels: { in_app: false, feishu: true },
        types: { task_failed: { in_app: null, feishu: true } },
      })
    })

    it("非对象 / null → 安全默认", () => {
      expect(normalizeNotificationPreferences(null)).toEqual(defaultNotificationPreferences())
      expect(normalizeNotificationPreferences("x")).toEqual(defaultNotificationPreferences())
    })

    it("缺 channels / channels 非 bool → 回落默认 channels", () => {
      expect(normalizeNotificationPreferences({ types: {} }).channels).toEqual({ in_app: true, feishu: false })
      expect(
        normalizeNotificationPreferences({ channels: { in_app: "yes" }, types: {} }).channels,
      ).toEqual({ in_app: true, feishu: false })
    })

    it("types 非对象 → {}", () => {
      expect(normalizeNotificationPreferences({ channels: { in_app: true, feishu: false }, types: 7 }).types).toEqual({})
    })

    it("legacy 扁平键被忽略,落安全默认", () => {
      expect(normalizeNotificationPreferences({ task_completed: true, task_failed: true })).toEqual(
        defaultNotificationPreferences(),
      )
    })

    it("未知类型键丢弃,只保留已知 5 类型", () => {
      const out = normalizeNotificationPreferences({
        channels: { in_app: true, feishu: false },
        types: { bogus: { in_app: false }, visual_failed: { in_app: false } },
      })
      expect(out.types).toEqual({ visual_failed: { in_app: false } })
    })
  })

  it("isMasterInAppOn", () => {
    expect(isMasterInAppOn({ channels: { in_app: true, feishu: false }, types: {} })).toBe(true)
    expect(isMasterInAppOn({ channels: { in_app: false, feishu: false }, types: {} })).toBe(false)
  })

  it("isTypeInAppOn:true/undefined/null → 开,仅显式 false → 关", () => {
    const base = defaultNotificationPreferences()
    expect(isTypeInAppOn(base, "task_completed")).toBe(true) // 未设
    expect(isTypeInAppOn({ ...base, types: { task_completed: { in_app: true } } }, "task_completed")).toBe(true)
    expect(isTypeInAppOn({ ...base, types: { task_completed: { in_app: null } } }, "task_completed")).toBe(true)
    expect(isTypeInAppOn({ ...base, types: { task_completed: { in_app: false } } }, "task_completed")).toBe(false)
  })

  it("setMasterInApp:改 in_app,feishu 原样保留", () => {
    const prefs = { channels: { in_app: true, feishu: true }, types: {} }
    expect(setMasterInApp(prefs, false)).toEqual({ channels: { in_app: false, feishu: true }, types: {} })
  })

  it("setTypeInApp:写显式 true/false,该类型 feishu + 其它类型原样保留", () => {
    const prefs = {
      channels: { in_app: true, feishu: true },
      types: { task_failed: { in_app: null, feishu: true } },
    }
    const next = setTypeInApp(prefs, "task_completed", false)
    expect(next).toEqual({
      channels: { in_app: true, feishu: true },
      types: { task_failed: { in_app: null, feishu: true }, task_completed: { in_app: false } },
    })
    // 不可变:原对象不被修改
    expect(prefs.types).toEqual({ task_failed: { in_app: null, feishu: true } })
  })

  it("setTypeInApp:重写已有类型时保留其 feishu", () => {
    const prefs = {
      channels: { in_app: true, feishu: false },
      types: { task_failed: { in_app: false, feishu: true } },
    }
    expect(setTypeInApp(prefs, "task_failed", true).types.task_failed).toEqual({ in_app: true, feishu: true })
  })
})
