import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Theme } from "@/styles/theme-config";

import { cn } from "./utils";

const badgeVariants = cva(
  // Padding 4px 12px，圆角 9999px（完全圆角），字号 12px
  "inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-medium w-fit whitespace-nowrap shrink-0 transition-colors border-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        destructive: "bg-destructive text-white",
        outline: "border border-[#E2E8F0] text-foreground",
        // 状态标签变体
        // Pending: 背景 #FEF3C7，文字 #92400E
        pending: "bg-[#FEF3C7] text-[#92400E]",
        // Processing: 背景 #DBEAFE，文字 #1E40AF
        processing: "bg-[#DBEAFE] text-[#1E40AF]",
        // Completed: 背景 #DCFCE7，文字 #166534
        completed: "bg-[#DCFCE7] text-[#166534]",
        // Failed: 背景 #FEE2E2，文字 #991B1B
        failed: "bg-[#FEE2E2] text-[#991B1B]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

// 获取深色模式下的 Badge 样式
function getDarkModeStyle(variant: string | null | undefined) {
  if (!variant) return {};
  
  switch (variant) {
    case 'processing':
      return {
        background: 'rgba(59, 130, 246, 0.2)',
        color: '#60A5FA'
      };
    case 'completed':
      return {
        background: 'rgba(16, 185, 129, 0.2)',
        color: '#34D399'
      };
    case 'failed':
      return {
        background: 'rgba(239, 68, 68, 0.2)',
        color: '#F87171'
      };
    case 'pending':
      return {
        background: 'rgba(245, 158, 11, 0.2)',
        color: '#FBBF24'
      };
    default:
      return {};
  }
}

function Badge({
  className,
  variant,
  asChild = false,
  theme = 'light',
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean; theme?: Theme }) {
  const Comp = asChild ? Slot : "span";
  const darkStyle = theme === 'dark' ? getDarkModeStyle(variant) : {};

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      style={darkStyle}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
