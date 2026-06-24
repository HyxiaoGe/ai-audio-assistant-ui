"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  NOTIFICATION_TYPE_KEYS,
  isMasterInAppOn,
  isTypeInAppOn,
} from "@/lib/notification-preferences"
import type { NotificationTypeKey, UserPreferencesNotifications } from "@/types/api"

interface NotificationSettingsCardProps {
  prefs: UserPreferencesNotifications
  onChangeMaster: (on: boolean) => void
  onChangeType: (key: NotificationTypeKey, on: boolean) => void
  t: (key: string) => string
}

export function NotificationSettingsCard({
  prefs,
  onChangeMaster,
  onChangeType,
  t,
}: NotificationSettingsCardProps) {
  const masterOn = isMasterInAppOn(prefs)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.notificationsTitle")}</CardTitle>
        <CardDescription>{t("settings.notificationsDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="notif-master">{t("settings.notificationsMasterLabel")}</Label>
            <p className="text-sm text-[var(--app-text-muted)]">
              {t("settings.notificationsMasterDesc")}
            </p>
          </div>
          <Switch id="notif-master" checked={masterOn} onCheckedChange={onChangeMaster} />
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-[var(--app-text)]">
              {t("settings.notifTypesTitle")}
            </h3>
            <p className="text-sm text-[var(--app-text-muted)]">
              {t("settings.notifTypesDesc")}
            </p>
          </div>

          <div
            className={`overflow-hidden rounded-xl border border-[var(--app-glass-border)] bg-[var(--app-glass-bg)] divide-y divide-[var(--app-glass-border)] transition-opacity ${
              masterOn ? "" : "opacity-60"
            }`}
          >
            {NOTIFICATION_TYPE_KEYS.map((key) => (
              <div key={key} className="flex items-center justify-between px-3 py-3">
                <Label htmlFor={`notif-${key}`} className="font-normal">
                  {t(`settings.notifType.${key}`)}
                </Label>
                <Switch
                  id={`notif-${key}`}
                  checked={isTypeInAppOn(prefs, key)}
                  disabled={!masterOn}
                  onCheckedChange={(v) => onChangeType(key, v)}
                />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
