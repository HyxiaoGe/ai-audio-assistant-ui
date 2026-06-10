"use client";

import { createContext, useContext, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
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
import { unwrapMarkdownFence } from "@/lib/markdown-fence";
import { useI18n } from "@/lib/i18n-context";

// 插件数组无依赖：提到模块级常量，避免每次渲染都新建数组而让 ReactMarkdown 拿到新引用。
const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS = [rehypeSanitize];

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
 * 承载「每来一张图就变」的图片相关可变值（streamingImages / mediaToken / imageModel）。
 *
 * 为什么用 Context 而非闭包进 components：react-markdown(default export `Markdown`)不是 memo 的，
 * 每次渲染都重跑 `post` 重新调用各 renderer。若把这些可变值闭包进 components 并放进 useMemo deps，
 * 每张图到达都会重建 components→各 renderer 函数换新引用→react-markdown 渲染出的元素 type 变了→
 * React 卸载重挂整棵子树（含每个在途加载的 <img>）→加载被打断→onError→永久停在「[图片：..]」、
 * 必须手刷（本 bug 根因）。
 *
 * 改法：components 提到模块级、引用恒定（renderer 不闭包任何可变值）。可变值经本 Context 下发，
 * 由「稳定身份」的 renderer 所渲染的子组件 useContext 读取。这样 react-markdown 重渲染时各元素
 * type 不变→就地协调、不重挂载 <img>；而 Context 变化又能让子组件拿到最新值把图刷出来。
 */
interface MarkdownImageContextValue {
  streamingImages: Map<string, StreamingImage>;
  mediaToken: string | null;
  imageModel: string | null | undefined;
}

const MarkdownImageContext = createContext<MarkdownImageContextValue>({
  streamingImages: new Map(),
  mediaToken: null,
  imageModel: null,
});

/**
 * `{{IMAGE: ..}}` 占位符段落的渲染子组件：从 Context 读当前图集 + 媒体 token，
 * 映射成 ImagePlaceholder 的 status/url。传 token-less 原始 URL + mediaToken，
 * 由 ImagePlaceholder/ImageLoader 内部拼 token 与失败换票重试（这里不要预拼，否则双重拼接）。
 */
function SummaryImagePlaceholder({ placeholder }: { placeholder: string }) {
  const { streamingImages, mediaToken } = useContext(MarkdownImageContext);
  const description = extractPlaceholderDescription(placeholder);
  const imageState = streamingImages.get(placeholder);
  return (
    <ImagePlaceholder
      description={description}
      status={imageState?.status || "generating"}
      imageUrl={imageState?.url || undefined}
      mediaToken={mediaToken}
      // 公开页 OSS 预签名直链的代理回落 URL(StreamingImage.fallbackUrl);私有页不设置=null,零变化。
      fallbackUrl={imageState?.fallbackUrl ?? null}
    />
  );
}

/**
 * 旧数据里的内联 `![](url)` 图片渲染子组件：从 Context 读媒体 token / 生成模型，
 * 给同源代理 URL 注入 token，并在图注追加生成模型。t 经 useI18n 自取（保持 renderer 稳定身份）。
 */
function MarkdownImg({ src, alt }: { src?: string; alt?: string }) {
  const { t } = useI18n();
  const { mediaToken, imageModel } = useContext(MarkdownImageContext);
  return (
    <figure style={{ margin: "16px 0" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src ? appendMediaToken(src, mediaToken) || undefined : undefined}
        alt={alt}
        style={{ maxWidth: "100%", borderRadius: "8px" }}
      />
      <figcaption
        style={{
          fontSize: "12px",
          color: "var(--app-text-subtle)",
          marginTop: "6px",
          textAlign: "center",
        }}
      >
        {alt}
        {imageModel && (
          <span style={{ marginLeft: "8px", opacity: 0.7 }}>
            · {t("summary.imageGeneratedBy", { model: formatModelName(imageModel) })}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

// components 提到模块级、引用恒定：renderer 不闭包任何可变值（可变值走 MarkdownImageContext），
// 故 react-markdown 重渲染时元素 type 不变、就地协调、不重挂载 <img>。
const MARKDOWN_COMPONENTS: Components = {
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
      return <SummaryImagePlaceholder placeholder={placeholderMatch} />;
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
  img: ({ src, alt }) => (
    <MarkdownImg src={typeof src === "string" ? src : undefined} alt={alt} />
  ),
  blockquote: ({ ...props }) => <blockquote {...props} className="border-l-4 pl-4 my-4 italic" style={{ borderColor: "var(--app-primary)", color: "var(--app-text-muted)" }} />,
};

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
  // 偶发：LLM 把整段正文包进 ```markdown ... ``` 围栏、后端原样落库，会让 react-markdown
  // 整段当代码块渲染、{{IMAGE:..}} 占位符进不了段落渲染器（图片不显示）。渲染前剥掉这层整段包裹。
  const normalizedContent = useMemo(() => unwrapMarkdownFence(content), [content]);

  // 把可变值下发给 Context（components 不再闭包它们）。memo 化避免无谓地让消费子组件重渲染。
  const imageContext = useMemo<MarkdownImageContextValue>(
    () => ({ streamingImages, mediaToken, imageModel }),
    [streamingImages, mediaToken, imageModel]
  );

  return (
    <MarkdownImageContext.Provider value={imageContext}>
      <div className="prose prose-sm max-w-none markdown-summary" style={{ color: 'var(--app-text)' }}>
        <ReactMarkdown
          remarkPlugins={REMARK_PLUGINS}
          rehypePlugins={REHYPE_PLUGINS}
          components={MARKDOWN_COMPONENTS}
        >
          {normalizedContent}
        </ReactMarkdown>
      </div>
    </MarkdownImageContext.Provider>
  );
}
