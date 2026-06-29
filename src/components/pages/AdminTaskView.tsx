"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { TranscriptList } from "@/components/task/TranscriptList";
import { MarkdownContent } from "@/components/task/MarkdownContent";
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
  const tid = String(params.tid);

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
      created_at: "",
      updated_at: "",
    }));
    return mapApiTranscript(segs, availableSpeakers, unknown);
  }, [transcripts, t]);

  if (error) return <p className="p-6 text-[var(--app-danger)]">{t("admin.taskView.loadError")}</p>;
  if (!detail) return <p className="p-6 text-[var(--app-text-muted)]">…</p>;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <p className="mb-2 text-xs text-[var(--app-text-muted)]">{t("admin.taskView.readonlyNote")}</p>
      <h1 className="text-xl font-semibold text-[var(--app-text)]">{detail.title ?? detail.id}</h1>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--app-text-muted)]">
        <span>{t("admin.taskView.status")}: {detail.status}</span>
        <span>{t("admin.taskView.created")}: {formatDateTime(detail.created_at)}</span>
        {detail.duration_seconds != null && (
          <span>{t("admin.taskView.duration")}: {detail.duration_seconds}s</span>
        )}
      </div>
      {detail.error_message && (
        <p className="mt-2 text-sm text-[var(--app-danger)]">
          {t("admin.taskView.errorMessage")}:{" "}
          <span>{detail.error_message}</span>
        </p>
      )}

      <h2 className="mb-2 mt-6 font-semibold text-[var(--app-text)]">{t("admin.taskView.summary")}</h2>
      {summaries.length === 0 ? (
        <p className="text-[var(--app-text-muted)]">{t("admin.taskView.noSummary")}</p>
      ) : (
        summaries.map((s) => (
          <div key={`${s.summary_type}-${s.version}`} className="mb-4">
            <MarkdownContent
              content={stripImageAnchors(s.content)}
              streamingImages={EMPTY_STREAMING_IMAGES}
              mediaToken={null}
            />
          </div>
        ))
      )}

      <h2 className="mb-2 mt-6 font-semibold text-[var(--app-text)]">{t("admin.taskView.transcript")}</h2>
      <TranscriptList
        transcript={displayTranscript}
        transcriptLoading={false}
        isActiveAudio={false}
        onTimeClick={noTimeClick}
        onEditSegment={noEditSegment}
        readOnly
      />
    </div>
  );
}
