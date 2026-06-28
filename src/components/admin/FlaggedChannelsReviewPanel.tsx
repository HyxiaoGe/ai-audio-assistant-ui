"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import EmptyState from "@/components/common/EmptyState";
import { useI18n } from "@/lib/i18n-context";
import { useAPIClient } from "@/lib/use-api-client";
import { useDateFormatter } from "@/lib/use-date-formatter";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notify";
import { ApiError, type FlaggedChannelOut } from "@/types/api";
import { Flag, ShieldBan, ShieldOff, ShieldAlert, ExternalLink } from "lucide-react";

type LoadState = "loading" | "ready" | "forbidden" | "error";

const FLAGS_PAGE_SIZE = 8;

function identityLabel(f: FlaggedChannelOut): string {
  return (
    f.channel_name ||
    (f.channel_handle ? `@${f.channel_handle}` : null) ||
    f.channel_id ||
    f.match_value
  );
}

function channelUrl(f: FlaggedChannelOut): string | null {
  if (f.channel_id) return `https://www.youtube.com/channel/${f.channel_id}`;
  if (f.channel_handle) return `https://www.youtube.com/@${f.channel_handle}`;
  return null;
}

export default function FlaggedChannelsReviewPanel() {
  const { t } = useI18n();
  const client = useAPIClient();
  const { formatDateTime } = useDateFormatter();

  const [items, setItems] = useState<FlaggedChannelOut[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [blockTarget, setBlockTarget] = useState<FlaggedChannelOut | null>(null);
  const [blockNote, setBlockNote] = useState("");
  const [dismissTarget, setDismissTarget] = useState<FlaggedChannelOut | null>(null);
  const busy = busyId !== null;

  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / FLAGS_PAGE_SIZE));
  const pagedItems = useMemo(
    () => items.slice((page - 1) * FLAGS_PAGE_SIZE, page * FLAGS_PAGE_SIZE),
    [items, page]
  );

  const reload = useCallback(async () => {
    try {
      const res = await client.getFlaggedChannels();
      setItems(res.items);
      setLoadState("ready");
    } catch (e) {
      // 列表错误不静默:前端 isAdmin 与后端 JWT scope 是不同字段,40300 可能发生 → 明确无权限态
      if (e instanceof ApiError && e.code === 40300) setLoadState("forbidden");
      else setLoadState("error");
    }
  }, [client]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const closeDialogs = useCallback(() => {
    setBlockTarget(null);
    setDismissTarget(null);
    setBlockNote("");
  }, []);

  const resolve = useCallback(
    async (target: FlaggedChannelOut, action: "block" | "dismiss", note?: string) => {
      if (busyId) return;
      setBusyId(target.id);
      try {
        await client.resolveFlaggedChannel(target.id, { action, note: note?.trim() || undefined });
        closeDialogs();
        await reload();
        notifySuccess(
          t(action === "block" ? "admin.flaggedChannels.blockSuccess" : "admin.flaggedChannels.dismissSuccess")
        );
      } catch (e) {
        // 40906 已被处理 / 40499 不存在:行已陈旧 → info 提示 + 刷新 + 关弹窗
        if (e instanceof ApiError && (e.code === 40906 || e.code === 40499)) {
          closeDialogs();
          notifyInfo(e.message);
          await reload();
        } else {
          notifyError(e instanceof Error ? e.message : t("admin.flaggedChannels.resolveError"));
        }
      } finally {
        setBusyId(null);
      }
    },
    [busyId, client, reload, closeDialogs, t]
  );

  const renderCard = (f: FlaggedChannelOut) => {
    const chUrl = channelUrl(f);
    const watchUrl = f.last_video_id ? `https://www.youtube.com/watch?v=${f.last_video_id}` : null;
    return (
      <li
        key={f.id}
        className="flex flex-col gap-2 rounded-lg border border-[var(--app-glass-border)] bg-[var(--app-glass-bg)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--app-text)] break-all">{identityLabel(f)}</span>
            {chUrl && (
              <a
                href={chUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-[var(--app-text-muted)] hover:text-[var(--app-primary)]"
                aria-label={t("admin.flaggedChannels.verifyOnYoutube")}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <Badge variant="secondary" className="shrink-0">
              {t("admin.flaggedChannels.hits", { count: String(f.block_count) })}
            </Badge>
          </div>
          {f.last_title && (
            <p className="text-xs text-[var(--app-text-muted)] break-all">
              {t("admin.flaggedChannels.recent")}: {f.last_title}
              {watchUrl && (
                <>
                  {" "}
                  <a
                    href={watchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--app-primary)] hover:underline"
                  >
                    {t("admin.flaggedChannels.verifyOnYoutube")}
                  </a>
                </>
              )}
            </p>
          )}
          {f.last_flagged_at && (
            <p className="text-xs text-[var(--app-text-faint)]">
              {t("admin.flaggedChannels.flaggedAt")}: {formatDateTime(f.last_flagged_at)}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="destructive" size="sm" disabled={busy} onClick={() => setBlockTarget(f)}>
            {t("admin.flaggedChannels.block")}
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => setDismissTarget(f)}>
            {t("admin.flaggedChannels.dismiss")}
          </Button>
        </div>
      </li>
    );
  };

  const renderBody = () => {
    if (loadState === "loading") {
      return (
        <div role="status" aria-busy="true" className="space-y-2">
          <span className="sr-only">{t("common.loading")}</span>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      );
    }
    if (loadState === "forbidden") {
      return (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <ShieldAlert className="h-10 w-10 text-[var(--app-danger)]" />
          <p className="text-sm text-[var(--app-text-muted)]">{t("admin.flaggedChannels.forbidden")}</p>
        </div>
      );
    }
    if (loadState === "error") {
      return (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-[var(--app-text-muted)]">{t("admin.flaggedChannels.loadError")}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setLoadState("loading");
              reload();
            }}
          >
            {t("admin.flaggedChannels.retry")}
          </Button>
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <EmptyState
          title={t("admin.flaggedChannels.emptyTitle")}
          description={t("admin.flaggedChannels.emptyDesc")}
        />
      );
    }
    return (
      <div className="space-y-3">
        <ul className="space-y-2">{pagedItems.map(renderCard)}</ul>
        {items.length > FLAGS_PAGE_SIZE && (
          <div className="flex items-center justify-center gap-3 pt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={busy || page <= 1}
            >
              {t("common.prevPage")}
            </Button>
            <span className="text-xs text-[var(--app-text-muted)] tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={busy || page >= totalPages}
            >
              {t("common.nextPage")}
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-[var(--app-primary)]" />
          {t("admin.flaggedChannels.title")}
        </CardTitle>
        <CardDescription>{t("admin.flaggedChannels.desc")}</CardDescription>
      </CardHeader>
      <CardContent>{renderBody()}</CardContent>

      {/* 拉黑确认(带可选备注) */}
      <Dialog
        open={blockTarget !== null}
        onOpenChange={(open) => {
          if (!open && !busy) closeDialogs();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldBan className="h-4 w-4 text-[var(--app-danger)]" />
              {t("admin.flaggedChannels.blockConfirmTitle")}
            </DialogTitle>
            <DialogDescription>{t("admin.flaggedChannels.blockConfirmDesc")}</DialogDescription>
          </DialogHeader>
          {blockTarget && (
            <div className="space-y-2">
              <p className="rounded-lg border border-[var(--app-glass-border)] bg-[var(--app-glass-bg)] px-3 py-2 text-sm text-[var(--app-text)] break-all">
                {identityLabel(blockTarget)} · {t("admin.flaggedChannels.hits", { count: String(blockTarget.block_count) })}
              </p>
              <label className="block text-xs text-[var(--app-text-muted)]">
                {t("admin.flaggedChannels.noteLabel")}
              </label>
              <textarea
                value={blockNote}
                onChange={(e) => setBlockNote(e.target.value)}
                rows={2}
                placeholder={t("admin.flaggedChannels.notePlaceholder")}
                className="w-full rounded-lg border border-[var(--app-glass-border)] bg-[var(--app-glass-bg)] px-3 py-2 text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-primary)]"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={closeDialogs} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => blockTarget && resolve(blockTarget, "block", blockNote)}
              disabled={busy}
            >
              {busyId && blockTarget && busyId === blockTarget.id
                ? t("admin.flaggedChannels.blocking")
                : t("admin.flaggedChannels.blockCta")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 加白确认(无备注) */}
      <Dialog
        open={dismissTarget !== null}
        onOpenChange={(open) => {
          if (!open && !busy) closeDialogs();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldOff className="h-4 w-4 text-[var(--app-text-muted)]" />
              {t("admin.flaggedChannels.dismissConfirmTitle")}
            </DialogTitle>
            <DialogDescription>{t("admin.flaggedChannels.dismissConfirmDesc")}</DialogDescription>
          </DialogHeader>
          {dismissTarget && (
            <p className="rounded-lg border border-[var(--app-glass-border)] bg-[var(--app-glass-bg)] px-3 py-2 text-sm text-[var(--app-text)] break-all">
              {identityLabel(dismissTarget)}
            </p>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={closeDialogs} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="default"
              onClick={() => dismissTarget && resolve(dismissTarget, "dismiss")}
              disabled={busy}
            >
              {busyId && dismissTarget && busyId === dismissTarget.id
                ? t("admin.flaggedChannels.dismissing")
                : t("admin.flaggedChannels.dismissCta")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
