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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);
  const [batchNote, setBatchNote] = useState("");
  const busy = busyId !== null;
  const anyBusy = busy || batchBusy;

  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / FLAGS_PAGE_SIZE));
  const pagedItems = useMemo(
    () => items.slice((page - 1) * FLAGS_PAGE_SIZE, page * FLAGS_PAGE_SIZE),
    [items, page]
  );

  // 全选只作用于「当前页」(分页是纯前端切片)——跨页全选是危险 footgun,业界惯例表头复选框只选当前页;
  // 想跨页累积仍可逐页全选或逐条勾选(selectedIds 跨页保留)。
  const pageIds = useMemo(() => pagedItems.map((i) => i.id), [pagedItems]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (pageIds.length === 0) return prev; // 空页守卫:every([]) 为 true 会误入取消分支并触发空渲染
      const next = new Set(prev);
      if (pageIds.every((id) => next.has(id))) {
        pageIds.forEach((id) => next.delete(id)); // 当前页已全选 → 取消当前页
      } else {
        pageIds.forEach((id) => next.add(id)); // 否则补齐当前页(保留其它页已选)
      }
      return next;
    });
  }, [pageIds]);

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

  // items 变化(任意 reload 后)即把选择集收敛到仍存在的 id,避免跨页累积出幽灵勾选;无变化返回 prev 不触发额外渲染
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const valid = new Set(items.map((i) => i.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (valid.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [items]);

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

  const submitBatch = useCallback(async () => {
    if (batchBusy || selectedIds.size === 0) return;
    setBatchBusy(true);
    try {
      const res = await client.batchResolveFlaggedChannels({
        flag_ids: Array.from(selectedIds),
        action: "block",
        note: batchNote.trim() || undefined,
      });
      setBatchConfirmOpen(false);
      setBatchNote("");
      await reload(); // 重拉 pending;已处置项消失 → 幽灵清理 effect 自动剪枝选择集
      const failed = res.items.filter((i) => i.status === "failed").length;
      if (failed === 0) {
        notifySuccess(t("admin.flaggedChannels.batchSuccess", { count: String(res.resolved_count) }));
      } else {
        notifyError(
          t("admin.flaggedChannels.batchPartial", {
            resolved: String(res.resolved_count),
            failed: String(failed),
          })
        );
      }
    } catch (e) {
      notifyError(e instanceof Error ? e.message : t("admin.flaggedChannels.resolveError"));
    } finally {
      setBatchBusy(false);
    }
  }, [batchBusy, selectedIds, client, batchNote, reload, t]);

  const renderCard = (f: FlaggedChannelOut) => {
    const chUrl = channelUrl(f);
    const watchUrl = f.last_video_id ? `https://www.youtube.com/watch?v=${f.last_video_id}` : null;
    return (
      <li
        key={f.id}
        className="flex items-start gap-3 rounded-lg border border-[var(--app-glass-border)] bg-[var(--app-glass-bg)] px-3 py-3"
      >
        <input
          type="checkbox"
          checked={selectedIds.has(f.id)}
          onChange={() => toggleSelect(f.id)}
          disabled={anyBusy}
          aria-label={t("admin.flaggedChannels.selectOne", { name: identityLabel(f) })}
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--app-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-primary)]"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
            <Button variant="destructive" size="sm" disabled={anyBusy} onClick={() => setBlockTarget(f)}>
              {t("admin.flaggedChannels.block")}
            </Button>
            <Button variant="outline" size="sm" disabled={anyBusy} onClick={() => setDismissTarget(f)}>
              {t("admin.flaggedChannels.dismiss")}
            </Button>
          </div>
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
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--app-glass-border)] bg-[var(--app-glass-bg)] px-3 py-2">
          <label className="flex items-center gap-2 text-sm text-[var(--app-text)]">
            <input
              type="checkbox"
              checked={allPageSelected}
              onChange={toggleSelectAll}
              disabled={anyBusy}
              className="h-4 w-4 accent-[var(--app-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-primary)]"
            />
            {t("admin.flaggedChannels.selectAll")}
          </label>
          <span className="text-xs text-[var(--app-text-muted)]">
            {t("admin.flaggedChannels.selectedCount", { count: String(selectedIds.size) })}
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={anyBusy || selectedIds.size === 0}
              onClick={clearSelection}
            >
              {t("admin.flaggedChannels.clearSelection")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={anyBusy || selectedIds.size === 0}
              onClick={() => setBatchConfirmOpen(true)}
            >
              {t("admin.flaggedChannels.batchBlock")}
            </Button>
          </div>
        </div>
        <ul className="space-y-2">{pagedItems.map(renderCard)}</ul>
        {items.length > FLAGS_PAGE_SIZE && (
          <div className="flex items-center justify-center gap-3 pt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={anyBusy || page <= 1}
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
              disabled={anyBusy || page >= totalPages}
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

      {/* 批量拉黑确认(单一备注应用全批) */}
      <Dialog
        open={batchConfirmOpen}
        onOpenChange={(open) => {
          if (!open && !batchBusy) {
            setBatchConfirmOpen(false);
            setBatchNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldBan className="h-4 w-4 text-[var(--app-danger)]" />
              {t("admin.flaggedChannels.batchConfirmTitle")}
            </DialogTitle>
            <DialogDescription>{t("admin.flaggedChannels.batchConfirmDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="rounded-lg border border-[var(--app-glass-border)] bg-[var(--app-glass-bg)] px-3 py-2 text-sm text-[var(--app-text)]">
              {t("admin.flaggedChannels.batchConfirmSummary", { count: String(selectedIds.size) })}
            </p>
            <label className="block text-xs text-[var(--app-text-muted)]">
              {t("admin.flaggedChannels.noteLabel")}
            </label>
            <textarea
              value={batchNote}
              onChange={(e) => setBatchNote(e.target.value)}
              rows={2}
              placeholder={t("admin.flaggedChannels.notePlaceholder")}
              className="w-full rounded-lg border border-[var(--app-glass-border)] bg-[var(--app-glass-bg)] px-3 py-2 text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-primary)]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setBatchConfirmOpen(false);
                setBatchNote("");
              }}
              disabled={batchBusy}
            >
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={submitBatch} disabled={batchBusy}>
              {batchBusy ? t("admin.flaggedChannels.batchBlocking") : t("admin.flaggedChannels.batchBlockCta")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
