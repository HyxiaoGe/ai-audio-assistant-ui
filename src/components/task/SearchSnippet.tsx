import { Fragment } from "react";

interface SearchSnippetProps {
  /** 后端 ts_headline 片段：命中词包在字面 <mark>…</mark> 内，其余为转写正文。 */
  text: string;
  className?: string;
}

// 用带捕获组的 split 按字面 <mark>…</mark> 切分：结果偶数下标是正文、奇数下标是被高亮的命中词。
// 两者都作为 React 文本子节点渲染（自动转义），绝不 dangerouslySetInnerHTML——转写正文用户可
// 影响，借此杜绝 XSS。（split 不依赖可变 lastIndex，纯函数式。）
const MARK_SPLIT = /<mark>([\s\S]*?)<\/mark>/;

/**
 * 安全渲染搜索片段的高亮。把后端返回的 <mark> 包裹词渲染成真正的 <mark> 元素，
 * 其余文本一律按纯文本渲染（含 < > & 等原样可见、不解析为 HTML）。
 */
export function SearchSnippet({ text, className }: SearchSnippetProps) {
  const parts = text.split(MARK_SPLIT);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        i % 2 === 1 ? <mark key={i}>{part}</mark> : <Fragment key={i}>{part}</Fragment>
      )}
    </span>
  );
}
