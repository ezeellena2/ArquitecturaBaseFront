import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/**
 * Charts that read again keep their place (board LC2-A, as a list that reads again): the line that runs over them and the
 * previous charts dimmed and out of reach, never a skeleton that makes the page jump. The first load is its owner's.
 */
export function ChartRefreshing({ active, children, className }: { active: boolean; children: ReactNode; className?: string }): ReactNode {
  return (
    <div aria-busy={active || undefined} className="relative">
      {active ? (
        <div data-slot="charts-refreshing" aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-2 z-10 h-0.5 overflow-hidden bg-[var(--color-brand-100)]">
          <div className="h-full w-1/3 animate-[table-refresh_1.2s_ease-in-out_infinite] bg-[var(--color-brand-500)] motion-reduce:animate-none" />
        </div>
      ) : null}
      <div inert={active || undefined} className={cn(className, active && "opacity-45")}>{children}</div>
    </div>
  );
}
