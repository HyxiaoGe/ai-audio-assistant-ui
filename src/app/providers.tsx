"use client"

import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "@/components/theme-provider"
import { SettingsProvider } from "@/lib/settings-context"
import { I18nProvider } from "@/lib/i18n-context"

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <SettingsProvider>
          <I18nProvider>
            {children}
          </I18nProvider>
        </SettingsProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}
