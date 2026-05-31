// 摘要/行动项的纯解析逻辑，从 TaskDetail 抽出（audit #8）。无 React/i18n 依赖，可独立单测。

export interface ActionItem {
  id: string;
  task: string;
  assignee: string;
  deadline: string;
  completed: boolean;
}

/** 行动项缺省占位文案；由调用方传入（已本地化），以保持本模块纯净。 */
export interface ActionItemLabels {
  pendingAssignee: string;
  pendingDeadline: string;
}

/**
 * 把 Markdown 摘要正文按行拆开，去掉列表/有序/复选框标记，trim 后过滤空行。
 */
export function parseSummaryLines(content?: string | null): string[] {
  if (!content) return [];
  return content
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/^\s*[-*]\s+/, '')
        .replace(/^\s*\d+\.\s+/, '')
        .replace(/^\s*\[[xX\s]\]\s+/, '')
        .trim()
    )
    .filter(Boolean);
}

/**
 * 解析行动项：识别完成态 `[x]`、负责人 `@name`、截止日期（`YYYY-M-D` 或 `M/D`），
 * 其余文本作为任务内容；缺省负责人/截止用传入的 labels。
 */
export function parseActionItems(
  content: string | null | undefined,
  labels: ActionItemLabels,
): ActionItem[] {
  if (!content) return [];
  const lines = content.split(/\n+/).map((line) => line.trim()).filter(Boolean);

  return lines.map((line, index) => {
    const completedMatch = line.match(/\[\s*[xX]\s*\]/);
    const cleaned = line
      .replace(/^\s*[-*]\s+/, '')
      .replace(/^\s*\[[xX\s]\]\s+/, '')
      .trim();

    const assigneeMatch = cleaned.match(/@([^\s]+)/);
    const deadlineMatch = cleaned.match(/\b(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2})\b/);

    const taskText = cleaned
      .replace(/@([^\s]+)/, '')
      .replace(/\b(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2})\b/, '')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      id: `action-${index + 1}`,
      task: taskText || cleaned,
      assignee: assigneeMatch ? assigneeMatch[1] : labels.pendingAssignee,
      deadline: deadlineMatch ? deadlineMatch[1] : labels.pendingDeadline,
      completed: Boolean(completedMatch),
    };
  });
}
