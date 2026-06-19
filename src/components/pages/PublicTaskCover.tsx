"use client";

import { useState } from "react";
import { Play } from "lucide-react";

interface PublicTaskCoverProps {
  /** 主封面:YouTube=同源代理缩略图直链,上传=AI 配图直链;无则 null。 */
  coverUrl: string | null;
  /** 回落封面(YouTube 任务的 AI 配图);主封面加载失败时切它。无则不参与。 */
  fallbackUrl?: string | null;
  alt: string;
}

/**
 * 探索封面图:三级回落 cover_url → cover_fallback_url → 占位(Play 图标)。
 *
 * YouTube 任务主封面是同源代理缩略图(绕开国内直连 i.ytimg.com 慢/被墙),万一代理/上游抓取
 * 失败,切到 AI 配图;再失败则占位。上传任务无回落,主封面失败直接占位。占位由父容器的渐变
 * 背景兜底视觉,这里只渲染图标。
 */
export default function PublicTaskCover({ coverUrl, fallbackUrl, alt }: PublicTaskCoverProps) {
  const candidates = [coverUrl, fallbackUrl].filter((u): u is string => !!u);
  const [idx, setIdx] = useState(0);

  if (idx >= candidates.length) {
    return <Play className="w-6 h-6" style={{ color: "var(--app-text-muted)" }} aria-hidden />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={candidates[idx]}
      alt={alt}
      loading="lazy"
      onError={() => setIdx((i) => i + 1)}
      className="w-full h-full object-cover"
    />
  );
}
