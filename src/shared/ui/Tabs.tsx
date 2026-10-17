import type { ComponentProps } from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "@/shared/lib/utils";

export function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex min-w-0 flex-col gap-3", className)} {...props} />;
}

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("flex min-w-0 shrink-0 items-center gap-1 overflow-x-auto border-b border-[var(--color-border)]", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex h-[var(--height-control)] shrink-0 items-center justify-center gap-1.5 border-b-2 border-transparent px-2.5 text-sm whitespace-nowrap text-[var(--color-content-muted)] transition-colors",
        "hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-content)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-brand-500)]",
        "data-[state=active]:border-[var(--color-brand-600)] data-[state=active]:font-semibold data-[state=active]:text-[var(--color-content)] disabled:pointer-events-none disabled:opacity-50 max-sm:min-h-11",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("min-w-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-500)]", className)}
      {...props}
    />
  );
}
