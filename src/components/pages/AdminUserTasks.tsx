"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n-context";
import { useAPIClient } from "@/lib/use-api-client";
import { useDateFormatter } from "@/lib/use-date-formatter";
import type { AdminUserTaskItem } from "@/types/api";

const PAGE_SIZE = 20;

export default function AdminUserTasks() {
  const { t } = useI18n();
  const client = useAPIClient();
  const { formatDateTime } = useDateFormatter();
  const params = useParams();
  const uid = String(params.uid);

  const [items, setItems] = useState<AdminUserTaskItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    client
      .getAdminUserTasks(uid, { page, page_size: PAGE_SIZE })
      .then((res) => {
        if (!active) return;
        setError(false);
        setItems(res.items);
        setTotal(res.total);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [client, uid, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-xl font-semibold text-[var(--app-text)]">{t("admin.userTasks.heading")}</h1>

      {error && <p className="text-[var(--app-danger)]">{t("admin.userTasks.loadError")}</p>}

      {!error && items.length === 0 && (
        <p className="text-[var(--app-text-muted)]">{t("admin.userTasks.empty")}</p>
      )}

      {items.length > 0 && (
        <ul className="divide-y">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                href={`/admin/tasks/${it.id}`}
                className="flex flex-col gap-1 py-3 hover:bg-[var(--app-glass-bg)]"
              >
                <span className="font-medium text-[var(--app-text)]">{it.title ?? it.id}</span>
                <span className="text-xs text-[var(--app-text-muted)]">
                  {(it.channel_title ?? it.source_type)} · {it.status} · {formatDateTime(it.created_at)}
                </span>
                {it.error_message && (
                  <span className="text-xs text-[var(--app-danger)]">{it.error_message}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center gap-3">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t("admin.userTasks.prev")}
          </Button>
          <span className="text-sm text-[var(--app-text-muted)]">
            {t("admin.userTasks.pageInfo", { page, total })}
          </span>
          <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            {t("admin.userTasks.next")}
          </Button>
        </div>
      )}
    </div>
  );
}
