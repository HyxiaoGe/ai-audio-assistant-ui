"use client";

import { Toaster } from 'sonner';

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"  // 改为右上角
      expand={false}
      richColors
      closeButton
      duration={5000}
      toastOptions={{
        className: 'glass-panel',
        style: {
          background: 'var(--app-glass-bg)',
          border: '1px solid var(--app-glass-border)',
          color: 'var(--app-text-strong)',
        },
      }}
    />
  );
}
