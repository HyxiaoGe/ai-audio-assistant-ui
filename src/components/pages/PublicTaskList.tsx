"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Clock, Play } from "lucide-react";
import EmptyState from "@/components/common/EmptyState";
import { useAPIClient } from "@/lib/use-api-client";
import { useI18n } from "@/lib/i18n-context";
import { useDateFormatter } from "@/lib/use-date-formatter";
import { formatDuration } from "@/lib/utils";
import type { PublicTaskListItem } from "@/types/api";

const PAGE_SIZE = 20;
const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

interface PublicTaskListProps {
  initialItems?: PublicTaskListItem[];
  initialTotal?: number;
}

function isNew(publishedAt: string | null): boolean {
  if (!publishedAt) return false;
  const ts = new Date(publishedAt).getTime();
  return Number.isFinite(ts) && Date.now() - ts < NEW_WINDOW_MS;
}

export default function PublicTaskList({ initialItems, initialTotal }: PublicTaskListProps) {
  const { t } = useI18n();
  const { formatDate } = useDateFormatter();
  const client = useAPIClient();

  const seeded = initialItems != null;
  const [items, setItems] = useState<PublicTaskListItem[]>(initialItems ?? []);
  const [total, setTotal] = useState(initialTotal ?? 0);
  const [page, setPage] = useState(1);
  // 最近一次发起请求的目标页(成功/失败都更新);page 仅在成功后更新,供分页禁用态计算。
  // 二者分离:翻页失败后「重试」要重试那个失败的目标页,而不是回到上一个成功页。
  const [pendingPage, setPendingPage] = useState(1);
  const [loading, setLoading] = useState(!seeded);
  const [error, setError] = useState(false);

  const load = useCallback(
    async (targetPage: number) => {
      setPendingPage(targetPage);
      setLoading(true);
      setError(false);
      try {
        const data = await client.getPublicTasks({ page: targetPage, page_size: PAGE_SIZE });
        setItems(data.items);
        setTotal(data.total);
        setPage(targetPage);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  // 已 SSR 预取首屏(seeded)则跳过首次拉取;未预取时客户端拉第 1 页。只跑一次。
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (!seeded) void load(1);
  }, [seeded, load]);

  useEffect(() => {
    // 慢隧道下消灭点击后的冷 chunk 串行:用户停留列表页时提前拉详情页重模块 chunk。
    void import("@/components/task/MarkdownContent");
    void import("@/components/pages/PublicTaskDetail");
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div
          className="size-5 border-2 rounded-full animate-spin"
          style={{ borderColor: "var(--app-primary) transparent var(--app-primary) var(--app-primary)" }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-sm" style={{ color: "var(--app-danger)" }}>{t("explore.loadFailed")}</p>
        <button
          onClick={() => void load(pendingPage)}
          className="px-4 py-2 text-sm border rounded-lg hover:bg-[var(--app-glass-bg-strong)] transition-colors"
          style={{ borderColor: "var(--app-border)", color: "var(--app-text)" }}
        >
          {t("explore.retry")}
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        variant="default"
        title={t("explore.emptyTitle")}
        description={t("explore.emptyDescription")}
      />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          // Link 对视口内自动 prefetch(RSC payload + 路由 chunk),消灭慢隧道下「点了没反应」。
          <Link
            key={item.id}
            href={`/explore/${item.id}`}
            prefetch={true}
            className="flex gap-3 p-3 border rounded-xl hover:bg-[var(--app-glass-bg-strong)] transition-colors"
            style={{ borderColor: "var(--app-border)", background: "var(--app-glass-bg)" }}
          >
            {/* 封面:摘要配图(境内 OSS 直链);无图→渐变占位 + 播放角标。别改回 YouTube 缩略图(Google 图床国内慢/被墙)。 */}
            <div
              className="relative flex-shrink-0 w-28 md:w-40 rounded-lg overflow-hidden flex items-center justify-center"
              style={{
                aspectRatio: "16 / 9",
                background: "linear-gradient(135deg, var(--app-glass-bg-strong), var(--app-glass-bg))",
              }}
            >
              {item.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.cover_url}
                  alt={item.title || t("audio.untitled")}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Play className="w-6 h-6" style={{ color: "var(--app-text-muted)" }} />
              )}
              {isNew(item.published_at) && (
                <span
                  className="absolute left-1.5 top-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: "var(--app-primary)", color: "#fff", letterSpacing: "0.5px" }}
                >
                  {t("explore.newBadge")}
                </span>
              )}
            </div>

            {/* 右侧:标题 + excerpt + chips + 公开时间 */}
            <div className="flex-1 min-w-0">
              <div className="text-base line-clamp-2" style={{ fontWeight: 500, color: "var(--app-text)" }}>
                {item.title || t("audio.untitled")}
              </div>
              {item.excerpt && (
                <p className="text-xs mt-1 line-clamp-1" style={{ color: "var(--app-text-muted)" }}>
                  {item.excerpt}
                </p>
              )}
              <div
                className="flex flex-wrap items-center gap-2 mt-2 text-[11px]"
                style={{ color: "var(--app-text-muted)" }}
              >
                <span className="px-1.5 py-0.5 rounded-full border" style={{ borderColor: "var(--app-border)" }}>
                  {item.source_type === "youtube" ? "YouTube" : t("explore.sourceFile")}
                </span>
                {item.duration_seconds != null && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(item.duration_seconds)}
                  </span>
                )}
                {item.published_at && (
                  <span>{t("explore.publishedAt")} {formatDate(item.published_at)}</span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {totalPages > 1 && (
        <div
          className="flex items-center justify-center gap-4 mt-8 text-sm"
          style={{ color: "var(--app-text-muted)" }}
        >
          <button
            disabled={page <= 1}
            onClick={() => void load(page - 1)}
            className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-[var(--app-glass-bg-strong)] transition-colors"
            style={{ borderColor: "var(--app-border)" }}
          >
            {t("explore.prevPage")}
          </button>
          <span>{page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => void load(page + 1)}
            className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-[var(--app-glass-bg-strong)] transition-colors"
            style={{ borderColor: "var(--app-border)" }}
          >
            {t("explore.nextPage")}
          </button>
        </div>
      )}
    </>
  );
}
