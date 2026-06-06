// 偶发场景修复：LLM 有时把整段 Markdown 摘要正文包进 ```markdown ... ``` 代码围栏返回，
// 后端原样落库。react-markdown 会把整段当成单个 fenced code block 渲染成等宽原文，
// {{IMAGE:..}} 占位符永不进入段落渲染器 → 图片不显示（标题/加粗也退化为原文）。
// 渲染前在边界处剥掉这一层「整段包裹」的围栏；外科手术式，绝不误伤正文里合法的代码块。

const FENCE = "`".repeat(3) // ```

// 开围栏行：仅当 info string 为空或 markdown/md（区分大小写无关）才认作「整段 Markdown 包裹」，
// ```python 之类有真实语言的代码块一律不动。
const OPEN_FENCE_RE = /^`{3}(markdown|md)?\s*$/i
// 闭围栏行：纯 ``` （可带尾随空白）。
const CLOSE_FENCE_RE = /^`{3}\s*$/
// 任意围栏起始（用于检测正文内的嵌套围栏）。
const ANY_FENCE_RE = /^`{3}/

/**
 * 若 `content` 整段被一层 ```markdown（或裸 ```）代码围栏包裹，剥掉这层围栏返回内部正文；
 * 否则原样返回。判定要求同时满足：
 *  - 首个非空行是开围栏（info 为空或 markdown/md）；
 *  - 末个非空行是闭围栏（纯 ```）；
 *  - 两者之间不含任何其他围栏行（保证是「单层整段包裹」，而非含嵌套代码块的正文）。
 * 任一不满足即视为正文里的合法代码块/普通 Markdown，原样返回。
 */
export function unwrapMarkdownFence(content: string): string {
  if (!content || !content.includes(FENCE)) return content

  const lines = content.split("\n")

  let first = 0
  while (first < lines.length && lines[first].trim() === "") first++
  let last = lines.length - 1
  while (last >= 0 && lines[last].trim() === "") last--

  // 需要开/闭两行分处不同行。
  if (first >= last) return content

  if (!OPEN_FENCE_RE.test(lines[first].trim())) return content
  if (!CLOSE_FENCE_RE.test(lines[last].trim())) return content

  // 正文区间内若还有围栏行，说明存在嵌套代码块，无法安全判定为「单层整段包裹」，放弃。
  for (let i = first + 1; i < last; i++) {
    if (ANY_FENCE_RE.test(lines[i].trim())) return content
  }

  return lines.slice(first + 1, last).join("\n").trim()
}
