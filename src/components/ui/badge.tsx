import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
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
        outline: "border border-[var(--app-glass-border)] text-[var(--app-text)]",
        // 状态标签变体
        // Pending: 背景 #FEF3C7，文字 #92400E
        pending: "bg-[var(--app-warning-bg)] text-[var(--app-warning-strong)]",
        // Processing: 背景 #DBEAFE，文字 #1E40AF
        processing: "bg-[var(--app-primary-soft)] text-[var(--app-primary)]",
        // Completed: 背景 #DCFCE7，文字 #166534
        completed: "bg-[var(--app-success-bg)] text-[var(--app-success)]",
        // Failed: 背景 #FEE2E2，文字 #991B1B
        failed: "bg-[var(--app-danger-bg)] text-[var(--app-danger-deep)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
