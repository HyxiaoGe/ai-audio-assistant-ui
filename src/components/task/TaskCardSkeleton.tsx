import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n-context";

interface TaskCardSkeletonProps {
  count?: number;
}

export default function TaskCardSkeleton({ count = 6 }: TaskCardSkeletonProps) {
  const { t } = useI18n();
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">{t("common.loading")}</span>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          data-testid="task-card-skeleton"
          className="glass-item w-full rounded-xl p-5 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <Skeleton className="w-6 h-6 flex-shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-6 w-16 rounded-full flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}
