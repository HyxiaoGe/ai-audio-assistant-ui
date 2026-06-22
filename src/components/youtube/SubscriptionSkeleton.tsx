import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n-context";

interface SkeletonProps {
  count?: number;
}

export function ChannelListSkeleton({ count = 6 }: SkeletonProps) {
  const { t } = useI18n();
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{t("common.loading")}</span>
      <div className="flex gap-3 px-1 pt-1 pb-4">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            data-testid="channel-card-skeleton"
            className="flex-shrink-0 w-[140px] rounded-xl border p-3 flex flex-col items-center gap-2"
            style={{
              borderColor: "var(--app-glass-border)",
              background: "var(--app-glass-bg)",
            }}
          >
            <Skeleton className="w-12 h-12 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function VideoGridSkeleton({ count = 8 }: SkeletonProps) {
  const { t } = useI18n();
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{t("common.loading")}</span>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            data-testid="video-card-skeleton"
            className="rounded-xl border overflow-hidden"
            style={{
              borderColor: "var(--app-glass-border)",
              background: "var(--app-glass-bg)",
            }}
          >
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
