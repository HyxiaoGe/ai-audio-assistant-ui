// 管理员成本看板的纯展示逻辑（与组件解耦、可单测）。
//
// 双币种刻意分两列：¥（ASR/配图）与 $（LLM）不同币种，绝不相加。LLM 列在来源不可用
// （无 master key）或该行无值时显示「未配置」而非金额。

import type { AdminCostsResponse } from "@/types/api"

/**
 * 金额格式化：symbol + 数值。成本可能极小（$0.0064），故保留至多 4 位小数；
 * 第 3/4 位为零时收敛到 2 位（¥3.50、¥1.25），整洁可读。
 */
export function formatMoney(value: number, symbol: string): string {
  let s = value.toFixed(4)
  if (s.endsWith("00")) {
    s = value.toFixed(2)
  }
  return `${symbol}${s}`
}

/**
 * LLM 列是否应显示「未配置」：来源不可用，或该行无 spend 值。
 */
export function isLlmUnavailable(
  llmUsd: number | null,
  llmSource: AdminCostsResponse["llm_source"]
): boolean {
  return llmSource === "unavailable" || llmUsd == null
}

/**
 * 成本看板某行的用户名展示文案：
 * - displayName 为空时回落到 fallback（如「未命名用户」）；
 * - 该行是当前查看者本人（isSelf）时，在名字后追加 selfSuffix（如「（你）」）以示区分。
 */
export function formatUserName(
  displayName: string | null,
  opts: { isSelf: boolean; fallback: string; selfSuffix: string }
): string {
  const base = displayName || opts.fallback
  return opts.isSelf ? `${base}${opts.selfSuffix}` : base
}
