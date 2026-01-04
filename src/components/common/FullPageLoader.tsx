"use client"

import { useI18n } from "@/lib/i18n-context"

interface FullPageLoaderProps {
  labelKey?: string
}

export default function FullPageLoader({ labelKey = "common.loading" }: FullPageLoaderProps) {
  const { t } = useI18n()

  return (
    <div
      className="h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "var(--app-bg)" }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 500px at 20% -10%, rgba(56, 189, 248, 0.18), transparent 60%)," +
            "radial-gradient(900px 500px at 90% 10%, rgba(34, 197, 94, 0.12), transparent 60%)," +
            "linear-gradient(180deg, rgba(15, 23, 42, 0.05) 0%, rgba(15, 23, 42, 0.2) 100%)",
        }}
      />
      <div className="relative flex flex-col items-center gap-4 text-center">
        <div
          className="absolute -top-12 -left-24 size-36 rounded-full blur-3xl"
          style={{ background: "rgba(56, 189, 248, 0.25)", animation: "floatGlow 6s ease-in-out infinite" }}
        />
        <div
          className="absolute -bottom-16 -right-20 size-40 rounded-full blur-3xl"
          style={{ background: "rgba(34, 197, 94, 0.2)", animation: "floatGlow 7s ease-in-out infinite 0.6s" }}
        />
        <div className="flex items-center gap-3 relative animate-fade-in">
          <span
            className="inline-flex size-2.5 rounded-full"
            style={{ background: "var(--app-primary)", animation: "loaderPulse 1.4s ease-in-out infinite" }}
          />
          <span
            className="inline-flex size-2.5 rounded-full"
            style={{ background: "var(--app-success)", animation: "loaderPulse 1.4s ease-in-out infinite 0.4s" }}
          />
        </div>
      </div>
      <style jsx>{`
        @keyframes loaderPulse {
          0% {
            transform: scale(0.75);
            opacity: 0.4;
          }
          50% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(0.75);
            opacity: 0.4;
          }
        }
        @keyframes floatGlow {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
            opacity: 0.75;
          }
          50% {
            transform: translate3d(14px, -10px, 0);
            opacity: 1;
          }
        }
        .animate-fade-in {
          animation: fadeIn 0.5s ease-out both;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
