"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n-context";
import { useAPIClient } from "@/lib/use-api-client";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { BlocklistEntry } from "@/types/api";
import { ShieldBan, X } from "lucide-react";

// 全局互斥的「正在进行的写操作」:既做防重锁,又用于把加载态精确显示在被点的控件上。
type BusyAction = null | "term" | "channel" | "delete";

const CHANNELS_PAGE_SIZE = 10;

export default function YouTubeBlocklistPanel() {
  const { t } = useI18n();
  const client = useAPIClient();

  const [entries, setEntries] = useState<BlocklistEntry[]>([]);
  const [termValue, setTermValue] = useState("");
  const [channelValue, setChannelValue] = useState("");
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [pending, setPending] = useState<BlocklistEntry | null>(null); // 待二次确认删除的条目
  const [channelSearch, setChannelSearch] = useState("");
  const [channelPage, setChannelPage] = useState(1);
  const busy = busyAction !== null;

  const reload = useCallback(async () => {
    try {
      const res = await client.getYouTubeBlocklist();
      setEntries(res.items);
    } catch {
      // 列表加载失败静默(非关键路径,下次写操作会重新拉取);写操作失败才 toast 提示。
    }
  }, [client]);

  useEffect(() => {
    reload();
  }, [reload]);

  const terms = useMemo(() => entries.filter((e) => e.kind === "term"), [entries]);
  const channels = useMemo(() => entries.filter((e) => e.kind === "channel"), [entries]);

  const filteredChannels = useMemo(() => {
    const q = channelSearch.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter((e) => (e.name || e.raw_value).toLowerCase().includes(q));
  }, [channels, channelSearch]);

  const totalChannelPages = Math.max(1, Math.ceil(filteredChannels.length / CHANNELS_PAGE_SIZE));

  // 删除/搜索使可见集变小后,把越界页码 clamp 回最后一页,避免卡在空页。
  useEffect(() => {
    if (channelPage > totalChannelPages) setChannelPage(totalChannelPages);
  }, [channelPage, totalChannelPages]);

  const pagedChannels = useMemo(
    () => filteredChannels.slice((channelPage - 1) * CHANNELS_PAGE_SIZE, channelPage * CHANNELS_PAGE_SIZE),
    [filteredChannels, channelPage]
  );

  const add = useCallback(
    async (kind: "term" | "channel", value: string, clear: () => void) => {
      const v = value.trim();
      if (!v || busyAction) return;
      setBusyAction(kind);
      try {
        await client.addYouTubeBlocklistEntry({ kind, value: v });
        clear();
        await reload();
        notifySuccess(t("admin.blocklist.addSuccess"));
      } catch (e) {
        notifyError(e instanceof Error ? e.message : t("admin.blocklist.addError"));
      } finally {
        setBusyAction(null);
      }
    },
    [busyAction, client, reload, t]
  );

  const confirmRemove = useCallback(async () => {
    if (!pending || busyAction) return;
    setBusyAction("delete");
    try {
      await client.deleteYouTubeBlocklistEntry(pending.id);
      setPending(null);
      await reload();
      notifySuccess(t("admin.blocklist.removeSuccess"));
    } catch (e) {
      notifyError(e instanceof Error ? e.message : t("admin.blocklist.removeError"));
    } finally {
      setBusyAction(null);
    }
  }, [pending, busyAction, client, reload, t]);

  // 频道条目展示「按哪种维度匹配」,让管理员看出粘的链接是否已解析成规范 channel_id。
  const matchFieldLabel = useCallback(
    (field: string): string | null => {
      switch (field) {
        case "channel_id":
          return t("admin.blocklist.matchChannelId");
        case "channel_handle":
          return t("admin.blocklist.matchHandle");
        case "channel_name":
          return t("admin.blocklist.matchChannelName");
        default:
          return null; // 搜索词(query)等无需徽章
      }
    },
    [t]
  );

  const renderList = (items: BlocklistEntry[], emptyKey: string) => {
    if (items.length === 0) {
      return <p className="text-sm text-[var(--app-text-muted)]">{t(emptyKey)}</p>;
    }
    return (
      <ul className="space-y-2">
        {items.map((e) => {
          const badge = matchFieldLabel(e.match_field);
          return (
            <li
              key={e.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-[var(--app-glass-border)] bg-[var(--app-glass-bg)] px-3 py-2"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm text-[var(--app-text)] break-all">{e.name || e.raw_value}</span>
                {badge && (
                  <span className="text-xs text-[var(--app-text-muted)]">{badge}</span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPending(e)}
                disabled={busy}
                className="shrink-0 text-[var(--app-text-muted)] hover:text-[var(--app-danger)]"
              >
                <X className="w-4 h-4" />
                <span className="ml-1">{t("admin.blocklist.remove")}</span>
              </Button>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldBan className="w-4 h-4 text-[var(--app-primary)]" />
          {t("admin.blocklist.title")}
        </CardTitle>
        <CardDescription>{t("admin.blocklist.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* 屏蔽搜索词 */}
        <section className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-[var(--app-text)]">{t("admin.blocklist.termsTitle")}</h4>
            <p className="text-xs text-[var(--app-text-muted)]">{t("admin.blocklist.termsDesc")}</p>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(ev) => {
              ev.preventDefault();
              add("term", termValue, () => setTermValue(""));
            }}
          >
            <Input
              value={termValue}
              onChange={(ev) => setTermValue(ev.target.value)}
              placeholder={t("admin.blocklist.termPlaceholder")}
            />
            <Button type="submit" disabled={busy || !termValue.trim()}>
              {busyAction === "term" ? t("admin.blocklist.adding") : t("admin.blocklist.add")}
            </Button>
          </form>
          {renderList(terms, "admin.blocklist.termsEmpty")}
        </section>

        {/* 屏蔽频道 */}
        <section className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-[var(--app-text)]">{t("admin.blocklist.channelsTitle")}</h4>
            <p className="text-xs text-[var(--app-text-muted)]">{t("admin.blocklist.channelsDesc")}</p>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(ev) => {
              ev.preventDefault();
              add("channel", channelValue, () => setChannelValue(""));
            }}
          >
            <Input
              value={channelValue}
              onChange={(ev) => setChannelValue(ev.target.value)}
              placeholder={t("admin.blocklist.channelPlaceholder")}
            />
            <Button type="submit" disabled={busy || !channelValue.trim()}>
              {busyAction === "channel" ? t("admin.blocklist.adding") : t("admin.blocklist.add")}
            </Button>
          </form>
          <p className="text-xs text-[var(--app-text-muted)]">{t("admin.blocklist.channelHint")}</p>
          {channels.length > 0 && (
            <Input
              value={channelSearch}
              onChange={(ev) => {
                setChannelSearch(ev.target.value);
                setChannelPage(1);
              }}
              placeholder={t("admin.blocklist.channelSearchPlaceholder")}
            />
          )}
          {renderList(
            pagedChannels,
            channels.length === 0 ? "admin.blocklist.channelsEmpty" : "admin.blocklist.channelsNoMatch"
          )}
          {filteredChannels.length > CHANNELS_PAGE_SIZE && (
            <div className="flex items-center justify-center gap-3 pt-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setChannelPage((p) => Math.max(1, p - 1))}
                disabled={busy || channelPage <= 1}
              >
                {t("admin.blocklist.prevPage")}
              </Button>
              <span className="text-xs text-[var(--app-text-muted)] tabular-nums">
                {channelPage} / {totalChannelPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setChannelPage((p) => Math.min(totalChannelPages, p + 1))}
                disabled={busy || channelPage >= totalChannelPages}
              >
                {t("admin.blocklist.nextPage")}
              </Button>
            </div>
          )}
        </section>
      </CardContent>

      {/* 删除二次确认 */}
      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && busyAction !== "delete") setPending(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.blocklist.removeConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("admin.blocklist.removeConfirmDesc")}</DialogDescription>
          </DialogHeader>
          {pending && (
            <p className="rounded-lg border border-[var(--app-glass-border)] bg-[var(--app-glass-bg)] px-3 py-2 text-sm text-[var(--app-text)] break-all">
              {pending.name || pending.raw_value}
            </p>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPending(null)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmRemove} disabled={busy}>
              {busyAction === "delete" ? t("admin.blocklist.removing") : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
