"use client"

import { useMemo } from "react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useI18n } from "@/lib/i18n-context"
import type { LLMModel } from "@/types/api"

interface SummaryModelSelectProps {
  /** 可选模型列表（来自后端 /llm/models）。 */
  models: LLMModel[]
  /** 当前选中的 model_id 或 provider；null 表示由后端自动选。 */
  value: string | null
  /** 用户挑了别的或挑回"自动选择"时回调；null = 自动。 */
  onChange: (value: string | null) => void
  disabled?: boolean
  /** 透传到 SelectTrigger 上（控制宽度/字号等外观）。 */
  className?: string
  /** trigger 上未选时显示的占位文本。默认 i18n 的"自动选择"。 */
  placeholder?: string
  /** 调用方需要显式 id 时（label htmlFor 用），可以传。 */
  id?: string
}

const AUTO_VALUE = "auto"

/**
 * 共享的"摘要模型选择器"。
 *
 * 之前在 NewTaskModal 和 TaskDetail 各写了一份原生 <select>，导致：
 * 1. 原生下拉高度不受 CSS 控制，28 个模型展开撑满视口
 * 2. 灰显/原因 tooltip 等逻辑要在每个调用点重复写
 *
 * 统一用 Radix Select：max-h-80 内部滚动 + 默认 disabled 灰显 + 把
 * health_error 拼到选项末尾以中文友好原因展示。
 */
export function SummaryModelSelect({
  models,
  value,
  onChange,
  disabled,
  className,
  placeholder,
  id,
}: SummaryModelSelectProps) {
  const { t } = useI18n()

  const groups = useMemo(() => {
    const map = new Map<string, LLMModel[]>()
    models.forEach((m) => {
      const key = m.provider_display || m.display_name || m.provider
      const list = map.get(key) || []
      list.push(m)
      map.set(key, list)
    })
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }))
  }, [models])

  return (
    <Select
      value={value ?? AUTO_VALUE}
      onValueChange={(next) => onChange(next === AUTO_VALUE ? null : next)}
      disabled={disabled ?? models.length === 0}
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue placeholder={placeholder ?? t("task.summaryModelAutoOption")} />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        <SelectItem value={AUTO_VALUE}>{t("task.summaryModelAutoOption")}</SelectItem>
        {groups.map((group) => (
          <SelectGroup key={group.label}>
            <SelectLabel>{group.label}</SelectLabel>
            {group.items.map((model) => {
              const parts: string[] = [model.display_name || model.model_id || model.provider]
              if (model.cost_tier) {
                parts.push(
                  t(
                    `task.summaryModelCost${model.cost_tier.charAt(0).toUpperCase() + model.cost_tier.slice(1)}` as const
                  )
                )
              }
              if (!model.is_available) {
                parts.push(t("task.summaryModelUnavailable"))
                if (model.health_error) parts.push(model.health_error)
              } else if (model.is_recommended) {
                parts.push(t("task.summaryModelRecommended"))
              }
              const key = model.model_id || model.provider
              return (
                <SelectItem
                  key={key}
                  value={key}
                  disabled={!model.is_available}
                  className="pl-5"
                >
                  {`  ${parts.join(" · ")}`}
                </SelectItem>
              )
            })}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
