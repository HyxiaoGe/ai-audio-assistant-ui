"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n-context";
import { useAPIClient } from "@/lib/use-api-client";
import type { BlocklistEntry } from "@/types/api";
import { ShieldBan, X } from "lucide-react";

export default function YouTubeBlocklistPanel() {
  const { t } = useI18n();
  const client = useAPIClient();

  const [entries, setEntries] = useState<BlocklistEntry[]>([]);
  const [termValue, setTermValue] = useState("");
  const [channelValue, setChannelValue] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await client.getYouTubeBlocklist();
      setEntries(res.items);
    } catch {
      // 静默失败(管理后台,非关键路径)
    }
  }, [client]);

  useEffect(() => {
    reload();
  }, [reload]);

  const terms = useMemo(() => entries.filter((e) => e.kind === "term"), [entries]);
  const channels = useMemo(() => entries.filter((e) => e.kind === "channel"), [entries]);

  const add = useCallback(
    async (kind: "term" | "channel", value: string, clear: () => void) => {
      const v = value.trim();
      if (!v || busy) return;
      setBusy(true);
      try {
        await client.addYouTubeBlocklistEntry({ kind, value: v });
        clear();
        await reload();
      } catch {
        // 静默失败
      } finally {
        setBusy(false);
      }
    },
    [busy, client, reload]
  );

  const remove = useCallback(
    async (id: string) => {
      if (busy) return;
      setBusy(true);
      try {
        await client.deleteYouTubeBlocklistEntry(id);
        await reload();
      } catch {
        // 静默失败
      } finally {
        setBusy(false);
      }
    },
    [busy, client, reload]
  );

  const renderList = (items: BlocklistEntry[], emptyKey: string) => {
    if (items.length === 0) {
      return <p className="text-sm text-[var(--app-text-muted)]">{t(emptyKey)}</p>;
    }
    return (
      <ul className="space-y-2">
        {items.map((e) => (
          <li
            key={e.id}
            className="flex items-center justify-between rounded-lg border border-[var(--app-glass-border)] bg-[var(--app-glass-bg)] px-3 py-2"
          >
            <span className="text-sm text-[var(--app-text)] break-all">{e.raw_value}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => remove(e.id)}
              disabled={busy}
              className="text-[var(--app-text-muted)] hover:text-[var(--app-danger)]"
            >
              <X className="w-4 h-4" />
              <span className="ml-1">{t("admin.blocklist.remove")}</span>
            </Button>
          </li>
        ))}
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
          <div className="flex gap-2">
            <Input
              value={termValue}
              onChange={(ev) => setTermValue(ev.target.value)}
              placeholder={t("admin.blocklist.termPlaceholder")}
            />
            <Button onClick={() => add("term", termValue, () => setTermValue(""))} disabled={busy}>
              {t("admin.blocklist.add")}
            </Button>
          </div>
          {renderList(terms, "admin.blocklist.termsEmpty")}
        </section>

        {/* 屏蔽频道 */}
        <section className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-[var(--app-text)]">{t("admin.blocklist.channelsTitle")}</h4>
            <p className="text-xs text-[var(--app-text-muted)]">{t("admin.blocklist.channelsDesc")}</p>
          </div>
          <div className="flex gap-2">
            <Input
              value={channelValue}
              onChange={(ev) => setChannelValue(ev.target.value)}
              placeholder={t("admin.blocklist.channelPlaceholder")}
            />
            <Button onClick={() => add("channel", channelValue, () => setChannelValue(""))} disabled={busy}>
              {t("admin.blocklist.add")}
            </Button>
          </div>
          {renderList(channels, "admin.blocklist.channelsEmpty")}
        </section>
      </CardContent>
    </Card>
  );
}
