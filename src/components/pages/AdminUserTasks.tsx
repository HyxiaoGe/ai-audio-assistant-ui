"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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

  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [items, setItems] = useState<AdminUserTaskItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    client
      .getAdminUserTasks(uid, { page, page_size: PAGE_SIZE, q: submitted || undefined })
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
  }, [client, uid, page, submitted]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const runSearch = () => {
    setPage(1);
    setSubmitted(query.trim());
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("common.back")}
      </Link>

      <h1 className="text-xl font-semibold text-[var(--app-text)]">{t("admin.userTasks.heading")}</h1>

      <div className="flex items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") runSearch();
          }}
          placeholder={t("admin.userTasks.searchPlaceholder")}
        />
        <Button onClick={runSearch}>{t("admin.userTasks.search")}</Button>
      </div>

      {error && <p className="text-[var(--app-danger)]">{t("admin.userTasks.loadError")}</p>}

      {!error && items.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-[var(--app-text-muted)]">
            {submitted ? t("admin.userTasks.searchEmpty") : t("admin.userTasks.empty")}
          </CardContent>
        </Card>
      )}

      {items.length > 0 && (
        <Card>
          <CardContent className="px-2 py-2">
            <ul className="divide-y divide-[var(--app-border)]">
              {items.map((it) => (
                <li key={it.id}>
                  <Link
                    href={`/admin/tasks/${it.id}?uid=${encodeURIComponent(uid)}`}
                    className="flex flex-col gap-1 rounded-lg px-3 py-3 transition-colors hover:bg-[var(--app-glass-bg)]"
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
          </CardContent>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center gap-3">
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
