import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        // Primary: 背景 #0F172A，文字白色
        default:
          "bg-[var(--app-button-primary-bg)] text-[var(--app-button-primary-text)] hover:bg-[var(--app-button-primary-hover)] focus-visible:ring-[var(--app-primary)]",
        // Secondary: 背景白色，边框 #E2E8F0，文字 #0F172A
        secondary:
          "glass-control text-[var(--app-text)] hover:bg-[var(--app-glass-hover)] focus-visible:ring-[var(--app-primary)]",
        // Ghost: 背景透明，文字 #64748B
        ghost:
          "bg-transparent text-[var(--app-text-muted)] hover:bg-[var(--app-glass-hover)] hover:text-[var(--app-text)] focus-visible:ring-[var(--app-primary)]",
        destructive:
          "bg-[var(--app-danger)] text-white hover:bg-[var(--app-danger-strong)] focus-visible:ring-[var(--app-danger)]",
        outline:
          "glass-control text-[var(--app-text)] hover:bg-[var(--app-glass-hover)] hover:text-[var(--app-text)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // Small: 高度 32px，padding 12px 16px
        sm: "h-8 px-4 text-sm",
        // Medium: 高度 40px，padding 16px 24px
        default: "h-10 px-6",
        // Large: 高度 48px，padding 20px 32px
        lg: "h-12 px-8",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
