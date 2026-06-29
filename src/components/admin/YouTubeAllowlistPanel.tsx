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
import type { AllowlistEntry } from "@/types/api";
import { classifyChannelInput } from "@/lib/youtube-channel-classify";
import { ShieldCheck, X } from "lucide-react";

// 全局互斥的「正在进行的写操作」:既做防重锁,又用于把加载态精确显示在被点的控件上。
type BusyAction = null | "channel" | "delete";

const CHANNELS_PAGE_SIZE = 10;

export default function YouTubeAllowlistPanel() {
  const { t } = useI18n();
  const client = useAPIClient();

  const [entries, setEntries] = useState<AllowlistEntry[]>([]);
  const [channelQuery, setChannelQuery] = useState("");
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [pending, setPending] = useState<AllowlistEntry | null>(null); // 待二次确认删除的条目
  const [channelPage, setChannelPage] = useState(1);
  const busy = busyAction !== null;

  const reload = useCallback(async () => {
    try {
      const res = await client.getYouTubeAllowlist();
      setEntries(res.items);
    } catch {
      // 列表加载失败静默(非关键路径,下次写操作会重新拉取);写操作失败才 toast 提示。
    }
  }, [client]);

  useEffect(() => {
    reload();
  }, [reload]);

  const filteredChannels = useMemo(() => {
    const q = channelQuery.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => (e.name || e.raw_value).toLowerCase().includes(q));
  }, [entries, channelQuery]);

  const totalChannelPages = Math.max(1, Math.ceil(filteredChannels.length / CHANNELS_PAGE_SIZE));

  // 删除/搜索使可见集变小后,把越界页码 clamp 回最后一页,避免卡在空页。
  useEffect(() => {
    if (channelPage > totalChannelPages) setChannelPage(totalChannelPages);
  }, [channelPage, totalChannelPages]);

  const pagedChannels = useMemo(
    () => filteredChannels.slice((channelPage - 1) * CHANNELS_PAGE_SIZE, channelPage * CHANNELS_PAGE_SIZE),
    [filteredChannels, channelPage]
  );

  // 对当前输入做结构化判型(id/handle/name 三维),命中已放行条目即视为重复——
  // 覆盖子串过滤识别不出的粘贴链接/@handle/UCID 形态。空输入跳过。
  const alreadyAllowed = useMemo(() => {
    const q = channelQuery.trim();
    if (!q) return null;
    const cls = classifyChannelInput(q);
    return entries.find((e) => e.match_field === cls.matchField && e.normalized_value === cls.normalizedValue) ?? null;
  }, [entries, channelQuery]);

  const canAddChannel = channelQuery.trim() !== "" && filteredChannels.length === 0 && !alreadyAllowed;

  const add = useCallback(async () => {
    const v = channelQuery.trim();
    if (!v || busyAction) return;
    setBusyAction("channel");
    try {
      await client.addYouTubeAllowlistEntry({ value: v });
      setChannelQuery("");
      setChannelPage(1);
      await reload();
      notifySuccess(t("admin.allowlist.addSuccess"));
    } catch (e) {
      notifyError(e instanceof Error ? e.message : t("admin.allowlist.addError"));
    } finally {
      setBusyAction(null);
    }
  }, [busyAction, channelQuery, client, reload, t]);

  const confirmRemove = useCallback(async () => {
    if (!pending || busyAction) return;
    setBusyAction("delete");
    try {
      await client.deleteYouTubeAllowlistEntry(pending.id);
      setPending(null);
      await reload();
      notifySuccess(t("admin.allowlist.removeSuccess"));
    } catch (e) {
      notifyError(e instanceof Error ? e.message : t("admin.allowlist.removeError"));
    } finally {
      setBusyAction(null);
    }
  }, [pending, busyAction, client, reload, t]);

  // 放行条目展示「按哪种维度匹配」,让管理员看出粘的链接是否已解析成规范 channel_id。
  const matchFieldLabel = useCallback(
    (field: string): string | null => {
      switch (field) {
        case "channel_id":
          return t("admin.allowlist.matchChannelId");
        case "channel_handle":
          return t("admin.allowlist.matchHandle");
        case "channel_name":
          return t("admin.allowlist.matchChannelName");
        default:
          return null;
      }
    },
    [t]
  );

  const renderList = (items: AllowlistEntry[], emptyKey: string) => {
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
                <span className="ml-1">{t("admin.allowlist.remove")}</span>
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
          <ShieldCheck className="w-4 h-4 text-[var(--app-primary)]" />
          {t("admin.allowlist.title")}
        </CardTitle>
        <CardDescription>{t("admin.allowlist.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* 放行频道:搜索与添加合并为一个框 —— 输入即过滤,仅当无匹配项时「添加」点亮 */}
        <section className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-[var(--app-text)]">{t("admin.allowlist.channelsTitle")}</h4>
            <p className="text-xs text-[var(--app-text-muted)]">{t("admin.allowlist.channelsDesc")}</p>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(ev) => {
              ev.preventDefault();
              if (canAddChannel) add();
            }}
          >
            <Input
              value={channelQuery}
              onChange={(ev) => {
                setChannelQuery(ev.target.value);
                setChannelPage(1);
              }}
              placeholder={t("admin.allowlist.channelSearchOrAdd")}
            />
            <Button type="submit" disabled={busy || !canAddChannel}>
              {busyAction === "channel" ? t("admin.allowlist.adding") : t("admin.allowlist.add")}
            </Button>
          </form>
          {alreadyAllowed && (
            <p className="text-xs text-[var(--app-danger)]">{t("admin.allowlist.channelAlreadyAllowed")}</p>
          )}
          <p className="text-xs text-[var(--app-text-muted)]">{t("admin.allowlist.channelHint")}</p>
          {renderList(
            // 结构化命中但子串过滤没 surface(粘链接/@handle/UCID 非频道名子串)时,
            // 显示被命中的那条而非「无匹配」空态——否则「无匹配频道」与下方「已放行」提示自相矛盾。
            alreadyAllowed && pagedChannels.length === 0 ? [alreadyAllowed] : pagedChannels,
            entries.length === 0 ? "admin.allowlist.channelsEmpty" : "admin.allowlist.channelsNoMatch"
          )}
          {filteredChannels.length > CHANNELS_PAGE_SIZE && (
            <div className="flex items-center justify-center gap-3 pt-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setChannelPage((p) => Math.max(1, p - 1))}
                disabled={busy || channelPage <= 1}
              >
                {t("common.prevPage")}
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
                {t("common.nextPage")}
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
            <DialogTitle>{t("admin.allowlist.removeConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("admin.allowlist.removeConfirmDesc")}</DialogDescription>
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
              {busyAction === "delete" ? t("admin.allowlist.removing") : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
