"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TranscriptList } from "@/components/task/TranscriptList";
import { MarkdownContent } from "@/components/task/MarkdownContent";
import { TaskStatusBadge } from "@/components/task/TaskStatusBadge";
import { TaskErrorCallout } from "@/components/task/TaskErrorCallout";
import { useI18n } from "@/lib/i18n-context";
import { useAPIClient } from "@/lib/use-api-client";
import { useDateFormatter } from "@/lib/use-date-formatter";
import { mapApiTranscript } from "@/lib/transcript-mapping";
import type { TranscriptSegment } from "@/types/api";
import type { PublicTranscriptItem, PublicSummaryItem, TaskDetail } from "@/types/api";
import type { StreamingImage } from "@/types/api";

/** 纯文本视图:剥掉配图占位锚点(只读视图不渲染配图)。 */
function stripImageAnchors(content: string): string {
  return content.replace(/\{\{?IMAGE:[^{}]*\}\}?/g, "");
}

/** 模块级空图片状态表,避免每次渲染都创建新 Map 实例。 */
const EMPTY_STREAMING_IMAGES: Map<string, StreamingImage> = new Map();

/** 只读 noop:onTimeClick 签名 (time: string) => void */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const noTimeClick = (time: string) => {};
/** 只读 noop:onEditSegment 签名 (segmentId: string, newContent: string) => void */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const noEditSegment = (segmentId: string, newContent: string) => {};

export default function AdminTaskView() {
  const { t } = useI18n();
  const client = useAPIClient();
  const { formatDateTime } = useDateFormatter();
  const params = useParams();
  const searchParams = useSearchParams();
  const tid = String(params.tid);
  // 从列表页带过来的 uid:有则回列表,无则回 /admin 首页。
  const fromUid = searchParams.get("uid");
  const backHref = fromUid ? `/admin/users/${encodeURIComponent(fromUid)}/tasks` : "/admin";

  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [transcripts, setTranscripts] = useState<PublicTranscriptItem[]>([]);
  const [summaries, setSummaries] = useState<PublicSummaryItem[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      client.getAdminTaskDetail(tid),
      client.getAdminTaskTranscript(tid),
      client.getAdminTaskSummary(tid),
    ])
      .then(([d, tr, su]) => {
        if (!active) return;
        setError(false);
        setDetail(d);
        setTranscripts(tr.items);
        setSummaries(su.items);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [client, tid]);

  const displayTranscript = useMemo(() => {
    const unknown = t("transcript.unknownSpeaker");
    const availableSpeakers = [
      { name: t("transcript.speakerA"), color: "var(--app-primary)" },
      { name: t("transcript.speakerB"), color: "var(--app-success)" },
      { name: t("transcript.speakerC"), color: "var(--app-warning)" },
      { name: t("transcript.speakerD"), color: "var(--app-danger)" },
      { name: t("transcript.speakerE"), color: "var(--app-purple)" },
      { name: t("transcript.unknownSpeaker"), color: "var(--app-text-subtle)" },
    ];
    const segs: TranscriptSegment[] = transcripts.map((item) => ({
      id: String(item.sequence),
      sequence: item.sequence,
      speaker_id: item.speaker_id,
      speaker_label: item.speaker_label,
      content: item.content,
      start_time: item.start_time,
      end_time: item.end_time,
      confidence: null,
      words: null,
      is_edited: false,
      original_content: null,
      manually_edited: false,
      created_at: "",
      updated_at: "",
    }));
    return mapApiTranscript(segs, availableSpeakers, unknown);
  }, [transcripts, t]);

  const backLink = (
    <Link
      href={backHref}
      className="inline-flex items-center gap-1.5 text-sm text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
    >
      <ArrowLeft className="h-4 w-4" />
      {t("common.back")}
    </Link>
  );

  if (error)
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        {backLink}
        <p className="text-[var(--app-danger)]">{t("admin.taskView.loadError")}</p>
      </div>
    );
  if (!detail)
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        {backLink}
        <p className="text-[var(--app-text-muted)]">{t("common.loading")}…</p>
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {backLink}

      <Card>
        <CardHeader>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--app-glass-bg)] px-3 py-1 text-xs font-medium text-[var(--app-primary)]">
            <Lock className="h-3.5 w-3.5" />
            {t("admin.taskView.readonlyNote")}
          </span>
          <CardTitle className="mt-2 text-xl font-semibold text-[var(--app-text)]">
            {detail.title ?? detail.id}
          </CardTitle>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--app-text-muted)]">
            <TaskStatusBadge status={detail.status} />
            <span>{t("admin.taskView.created")}: {formatDateTime(detail.created_at)}</span>
            {detail.duration_seconds != null && (
              <span>{t("admin.taskView.duration")}: {detail.duration_seconds}s</span>
            )}
          </div>
        </CardHeader>
        {detail.error_message && (
          <CardContent>
            <TaskErrorCallout message={detail.error_message} />
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-[var(--app-text)]">
            {t("admin.taskView.summary")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summaries.length === 0 ? (
            <p className="text-[var(--app-text-muted)]">{t("admin.taskView.noSummary")}</p>
          ) : (
            summaries.map((s) => (
              <div key={`${s.summary_type}-${s.version}`} className="mb-4 last:mb-0">
                <MarkdownContent
                  content={stripImageAnchors(s.content)}
                  streamingImages={EMPTY_STREAMING_IMAGES}
                  mediaToken={null}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-[var(--app-text)]">
            {t("admin.taskView.transcript")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TranscriptList
            transcript={displayTranscript}
            transcriptLoading={false}
            isActiveAudio={false}
            onTimeClick={noTimeClick}
            onEditSegment={noEditSegment}
            readOnly
          />
        </CardContent>
      </Card>
    </div>
  );
}
