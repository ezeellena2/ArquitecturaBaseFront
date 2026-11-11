import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { ActionTooltip } from "./ActionTooltip";

/// Un filtro aplicado. Con `onRemove`, la cruz lo quita; sin ella se lee igual, donde el filtro no se quita, como en el
/// diálogo de exportar (EX1-A).
export function FilterChip({ children, removeLabel, onRemove }: { children: ReactNode } & (
  { removeLabel: string; onRemove: () => void } | { removeLabel?: never; onRemove?: never })) {
  return (
    <span className={cn("inline-flex min-h-6 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-brand-500)]/30 bg-[var(--color-brand-50)] pl-2.5 text-xs text-[var(--color-brand-700)]",
      onRemove ? "pr-1" : "pr-2.5")}>
      <span>{children}</span>
      {onRemove ? (
        <ActionTooltip label={removeLabel}>
          <button type="button" aria-label={removeLabel} onClick={onRemove} className="inline-flex size-5 items-center justify-center rounded-[var(--radius-control)] hover:bg-[var(--color-brand-500)]/20 focus-visible:outline-2 focus-visible:outline-[var(--color-brand-500)]">
            <span aria-hidden="true" className="text-sm leading-none">×</span>
          </button>
        </ActionTooltip>
      ) : null}
    </span>
  );
}
