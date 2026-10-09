import type { ComponentProps, ReactNode } from "react";
import { ChevronRightIcon } from "./icons";
import { cn } from "@/shared/lib/utils";

export function TableSectionToggle({ children, ...props }: Omit<ComponentProps<"button">, "className" | "style"> & { children: ReactNode; "aria-expanded": boolean }) {
  return <button {...props} type="button" className="flex min-h-10 w-full items-center gap-2.5 px-4 py-2 text-left text-sm font-medium text-[var(--color-content)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-brand-500)] max-sm:min-h-11">
    <ChevronRightIcon className={cn("size-3.5 shrink-0 text-[var(--color-content-muted)] transition-transform motion-reduce:transition-none", props["aria-expanded"] ? "rotate-90" : "")} />
    {children}
  </button>;
}
