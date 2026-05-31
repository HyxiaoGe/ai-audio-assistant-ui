"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import type { StreamingImage } from "@/types/api";
import { ImagePlaceholder } from "@/components/task/ImagePlaceholder";
import { formatModelName } from "@/lib/model-name";
import {
  extractImagePlaceholder,
  extractPlaceholderDescription,
} from "@/lib/image-placeholder";
import { appendMediaToken } from "@/lib/media-url";
import { useI18n } from "@/lib/i18n-context";

export interface MarkdownContentProps {
  /** 原始 Markdown 正文（摘要/要点/行动项，V1.2 格式）。 */
  content: string;
  /** 生成图片所用模型，渲染在图注里；无则不显示。 */
  imageModel?: string | null;
  /** 流式生成中的图片占位符状态表，key 为完整 `{{IMAGE: ..}}` 占位符。 */
  streamingImages: Map<string, StreamingImage>;
  /** 同源媒体代理 URL 的鉴权 token，注入到 img/占位符的 src。 */
  mediaToken: string | null;
}

/**
 * 摘要正文的 Markdown 渲染器，从 TaskDetail 抽出（audit #8 拆分第 2 步）。
 * 行为与原 `renderMarkdownContent` 完全一致：GFM 表格/任务列表、只读复选框、
 * 高/低优先级 li 着色、`{{IMAGE: ..}}` 占位符渲染为 ImagePlaceholder、
 * 图片 src 注入媒体 token、图注追加生成模型。
 */
export function MarkdownContent({
  content,
  imageModel,
  streamingImages,
  mediaToken,
}: MarkdownContentProps) {
  const { t } = useI18n();

  return (
    <div className="prose prose-sm max-w-none markdown-summary" style={{ color: 'var(--app-text)' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          input: ({ ...props }) => {
            if (props.type === "checkbox") {
              return <input {...props} className="mr-2 align-middle" readOnly style={{ cursor: "default" }} />;
            }
            return <input {...props} />;
          },
          table: ({ ...props }) => (
            <div className="overflow-x-auto my-4">
              <table {...props} className="min-w-full border-collapse" style={{ border: "1px solid var(--app-glass-border)" }} />
            </div>
          ),
          th: ({ ...props }) => (
            <th {...props} className="px-4 py-2 text-left font-semibold" style={{ backgroundColor: "var(--app-glass-bg)", borderBottom: "2px solid var(--app-glass-border)" }} />
          ),
          td: ({ ...props }) => (
            <td {...props} className="px-4 py-2" style={{ borderBottom: "1px solid var(--app-glass-border)" }} />
          ),
          ul: ({ ...props }) => <ul {...props} className="space-y-2 my-4" />,
          ol: ({ ...props }) => <ol {...props} className="space-y-2 my-4" />,
          li: ({ children, ...props }) => {
            const liContent = String(children);
            const isHighPriority = liContent.includes("高优先级") || liContent.includes("紧急");
            const isLowPriority = liContent.includes("低优先级") || liContent.includes("可选");
            return (
              <li {...props} className="leading-relaxed" style={isHighPriority ? { color: "var(--app-danger)" } : isLowPriority ? { color: "var(--app-text-subtle)" } : undefined}>
                {children}
              </li>
            );
          },
          h1: ({ ...props }) => <h1 {...props} className="text-2xl font-bold mt-6 mb-4" style={{ color: "var(--app-text)" }} />,
          h2: ({ ...props }) => <h2 {...props} className="text-xl font-semibold mt-5 mb-3" style={{ color: "var(--app-text)" }} />,
          h3: ({ ...props }) => <h3 {...props} className="text-lg font-semibold mt-4 mb-2" style={{ color: "var(--app-text)" }} />,
          p: ({ children, ...props }) => {
            // Check if children contain an image placeholder
            const text = String(children);
            const placeholderMatch = extractImagePlaceholder(text);

            if (placeholderMatch) {
              const description = extractPlaceholderDescription(placeholderMatch);
              const imageState = streamingImages.get(placeholderMatch);

              return (
                <ImagePlaceholder
                  description={description}
                  status={imageState?.status || "generating"}
                  imageUrl={appendMediaToken(imageState?.url, mediaToken) || undefined}
                />
              );
            }

            return <p {...props} className="my-3 leading-relaxed">{children}</p>;
          },
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return <code {...props} className="px-1.5 py-0.5 rounded text-sm" style={{ backgroundColor: "var(--app-glass-bg)", color: "var(--app-primary)" }}>{children}</code>;
            }
            return <code {...props} className={`block p-3 rounded text-sm overflow-x-auto ${className || ""}`} style={{ backgroundColor: "var(--app-glass-bg)" }}>{children}</code>;
          },
          img: ({ src, alt, ...props }) => (
            <figure style={{ margin: '16px 0' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={typeof src === 'string' ? (appendMediaToken(src, mediaToken) || undefined) : src} alt={alt} {...props} style={{ maxWidth: '100%', borderRadius: '8px' }} />
              <figcaption
                style={{
                  fontSize: '12px',
                  color: 'var(--app-text-subtle)',
                  marginTop: '6px',
                  textAlign: 'center',
                }}
              >
                {alt}
                {imageModel && (
                  <span style={{ marginLeft: '8px', opacity: 0.7 }}>
                    · {t("summary.imageGeneratedBy", { model: formatModelName(imageModel) })}
                  </span>
                )}
              </figcaption>
            </figure>
          ),
          blockquote: ({ ...props }) => <blockquote {...props} className="border-l-4 pl-4 my-4 italic" style={{ borderColor: "var(--app-primary)", color: "var(--app-text-muted)" }} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
