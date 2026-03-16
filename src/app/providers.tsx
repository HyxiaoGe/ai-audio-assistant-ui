"use client"

import { ThemeProvider } from "@/components/theme-provider"
import { SettingsProvider } from "@/lib/settings-context"
import { I18nProvider } from "@/lib/i18n-context"
import { AuthProvider } from "@/components/providers/AuthProvider"

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <AuthProvider>
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
    </AuthProvider>
  )
}
