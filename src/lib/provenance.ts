/**
 * 溯源字段格式化:把后端透出的 ASR provider/engine/variant 组装成徽章所需的
 * { label, detail }。provider 缺失(旧任务未捕获)→ 返回 null,调用方据此不渲染徽章。
 */

export interface AsrProvenanceInput {
  provider?: string | null;
  engine?: string | null;
  variant?: string | null;
}

export interface ProvenanceParts {
  /** 徽章可见文本(provider 本地化显示名,如 tencent→腾讯云)。 */
  label: string;
  /** 悬浮明细:label · engine · variant(跳过空段)。 */
  detail: string;
}

/**
 * @param input ASR 溯源原始字段。
 * @param resolveDisplayName 把 provider 解析为本地化显示名;返回 undefined 时回退原始 provider。
 */
export function formatAsrProvenance(
  input: AsrProvenanceInput,
  resolveDisplayName?: (provider: string) => string | undefined
): ProvenanceParts | null {
  const provider = input.provider?.trim();
  if (!provider) {
    return null;
  }

  const label = (resolveDisplayName?.(provider) || provider).trim();
  const detail = [label, input.engine?.trim(), input.variant?.trim()]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  return { label, detail };
}
