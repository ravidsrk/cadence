import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full min-w-0 rounded-md bg-secondary px-3 text-sm text-foreground outline-none shadow-[var(--shadow-border)] transition-[box-shadow,background-color] duration-150 ease-out placeholder:text-muted-foreground focus-visible:shadow-[var(--shadow-border-hover)] focus-visible:ring-2 focus-visible:ring-ring/70 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
