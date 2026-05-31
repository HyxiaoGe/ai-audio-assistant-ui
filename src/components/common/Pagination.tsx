"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * 共享分页控件（audit a11y #29-#32）。
 * 上一页/下一页原为只含图标的无名按钮：补 type + aria-label，图标 aria-hidden；
 * 当前页用 aria-current="page" 标注，省略号 aria-hidden。
 * TaskListAPI 与 TaskList 两处结构完全一致，抽此组件复用。
 */
export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const { t } = useI18n();
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label={t("pagination.previous")}
        className="glass-chip flex items-center justify-center size-9 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
      </button>

      {/* 页码显示：只显示首尾页与当前页前后2页 */}
      <div className="flex items-center gap-1">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
          if (
            page === 1 ||
            page === totalPages ||
            (page >= currentPage - 1 && page <= currentPage + 1)
          ) {
            return (
              <button
                key={page}
                type="button"
                onClick={() => onPageChange(page)}
                aria-current={page === currentPage ? "page" : undefined}
                className="glass-chip flex items-center justify-center min-w-9 h-9 px-3 rounded-lg text-sm"
                data-active={page === currentPage}
              >
                {page}
              </button>
            );
          } else if (page === currentPage - 2 || page === currentPage + 2) {
            return (
              <span
                key={page}
                className="flex items-center justify-center w-9 h-9 text-sm"
                style={{ color: "var(--app-text-subtle)" }}
                aria-hidden="true"
              >
                ...
              </span>
            );
          }
          return null;
        })}
      </div>

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label={t("pagination.next")}
        className="glass-chip flex items-center justify-center size-9 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
