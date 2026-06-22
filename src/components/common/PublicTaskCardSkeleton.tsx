import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n-context";

interface PublicTaskCardSkeletonProps {
  count?: number;
}

export default function PublicTaskCardSkeleton({ count = 5 }: PublicTaskCardSkeletonProps) {
  const { t } = useI18n();
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">{t("common.loading")}</span>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          data-testid="public-task-card-skeleton"
          className="flex gap-3 p-3 border rounded-xl"
          style={{ borderColor: "var(--app-border)", background: "var(--app-glass-bg)" }}
        >
          <Skeleton
            className="flex-shrink-0 w-28 md:w-40 rounded-lg"
            style={{ aspectRatio: "16 / 9" }}
          />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
