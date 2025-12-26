import * as React from "react";

import { cn } from "./utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // 高度 40px，边框 1px #E2E8F0，圆角 8px，Padding 12px 16px
        "flex h-10 w-full rounded-lg border border-[#E2E8F0] bg-white px-4 py-3 text-base transition-colors",
        "placeholder:text-[#94A3B8]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Focus: 边框 2px #3B82F6
        "focus-visible:outline-none focus-visible:border-2 focus-visible:border-[#3B82F6] focus-visible:ring-0",
        // Error: 边框 #EF4444
        "aria-invalid:border-[#EF4444] aria-invalid:focus-visible:border-[#EF4444]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
