import type {
  NotificationTypeKey,
  NotificationTypeToggles,
  UserPreferencesNotifications,
} from "@/types/api"

/** 后端 NotificationType 枚举对齐的 5 个类型 key,顺序即 UI 呈现顺序。 */
export const NOTIFICATION_TYPE_KEYS: readonly NotificationTypeKey[] = [
  "task_completed",
  "task_failed",
  "quota_alert",
  "youtube_reauth_required",
  "visual_failed",
]

/** 安全默认:总开关开、feishu 关、无类型覆写。 */
export function defaultNotificationPreferences(): UserPreferencesNotifications {
  return { channels: { in_app: true, feishu: false }, types: {} }
}

/**
 * 把后端 / legacy 响应稳健规整成安全矩阵:
 * 缺 channels 或字段非 bool → 回落默认;types 非对象 → {};
 * 仅保留已知 5 类型,逐键保留 in_app/feishu(含 null);legacy 扁平键忽略。
 * GET 已返回干净矩阵,本函数是防御兜底。
 */
export function normalizeNotificationPreferences(raw: unknown): UserPreferencesNotifications {
  const base = defaultNotificationPreferences()
  if (typeof raw !== "object" || raw === null) return base

  const obj = raw as { channels?: unknown; types?: unknown }

  let channels = base.channels
  if (typeof obj.channels === "object" && obj.channels !== null) {
    const ch = obj.channels as { in_app?: unknown; feishu?: unknown }
    channels = {
      in_app: typeof ch.in_app === "boolean" ? ch.in_app : base.channels.in_app,
      feishu: typeof ch.feishu === "boolean" ? ch.feishu : base.channels.feishu,
    }
  }

  const types: Partial<Record<NotificationTypeKey, NotificationTypeToggles>> = {}
  if (typeof obj.types === "object" && obj.types !== null) {
    const rawTypes = obj.types as Record<string, unknown>
    for (const key of NOTIFICATION_TYPE_KEYS) {
      const entry = rawTypes[key]
      if (typeof entry === "object" && entry !== null) {
        const e = entry as { in_app?: unknown; feishu?: unknown }
        const toggles: NotificationTypeToggles = {}
        if (typeof e.in_app === "boolean" || e.in_app === null) toggles.in_app = e.in_app
        if (typeof e.feishu === "boolean" || e.feishu === null) toggles.feishu = e.feishu
        types[key] = toggles
      }
    }
  }

  return { channels, types }
}

/** 总开关是否开。 */
export function isMasterInAppOn(prefs: UserPreferencesNotifications): boolean {
  return prefs.channels.in_app === true
}

/** 类型 in_app 是否开(不含总开关门控,门控由 UI disabled 表达)。 */
export function isTypeInAppOn(prefs: UserPreferencesNotifications, key: NotificationTypeKey): boolean {
  return prefs.types[key]?.in_app !== false
}

/** 设总开关,feishu 原样保留。 */
export function setMasterInApp(
  prefs: UserPreferencesNotifications,
  on: boolean,
): UserPreferencesNotifications {
  return { ...prefs, channels: { ...prefs.channels, in_app: on } }
}

/** 设某类型 in_app=true/false,该类型 feishu + 其它类型原样保留。 */
export function setTypeInApp(
  prefs: UserPreferencesNotifications,
  key: NotificationTypeKey,
  on: boolean,
): UserPreferencesNotifications {
  return {
    ...prefs,
    types: { ...prefs.types, [key]: { ...prefs.types[key], in_app: on } },
  }
}
