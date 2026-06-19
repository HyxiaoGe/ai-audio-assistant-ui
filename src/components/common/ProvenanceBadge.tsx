"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ProvenanceBadgeProps {
  /** 徽章可见文本（如模型短名 / provider）。为空/NULL 时不渲染任何东西。 */
  label?: string | null;
  /** 悬浮提示中的完整溯源明细（如 displayName / modelId、provider · engine · variant）。 */
  tooltip?: string | null;
  variant?: React.ComponentProps<typeof Badge>["variant"];
  className?: string;
}

/**
 * 溯源徽章：把「本次由哪个平台/模型支持」以胶囊徽章 + 悬浮明细呈现。
 *
 * 约定：label 为空/NULL 一律不渲染（旧任务未捕获溯源字段→不显示徽章，避免污染审计可信度）。
 * 完整明细同时写入 aria-label（无障碍 + 可确定性测试）与 Tooltip（视觉悬浮）。
 */
export function ProvenanceBadge({
  label,
  tooltip,
  variant = "outline",
  className,
}: ProvenanceBadgeProps) {
  const text = label?.trim();
  if (!text) {
    return null;
  }

  const detail = tooltip?.trim();
  const accessibleName = detail || text;

  if (!detail) {
    return (
      <Badge variant={variant} className={className} aria-label={accessibleName}>
        {text}
      </Badge>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={accessibleName}
          tabIndex={0}
          className="inline-flex cursor-default"
        >
          <Badge variant={variant} className={className}>
            {text}
          </Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent>{detail}</TooltipContent>
    </Tooltip>
  );
}
