import type { ReactNode } from "react";
import { ActionTooltip } from "./ActionTooltip";

export function FilterChip({ children, removeLabel, onRemove }: { children: ReactNode; removeLabel: string; onRemove: () => void }) {
  return (
    <span className="inline-flex min-h-6 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-brand-500)]/30 bg-[var(--color-brand-50)] pr-1 pl-2.5 text-xs text-[var(--color-brand-700)]">
      <span>{children}</span>
      <ActionTooltip label={removeLabel}>
        <button type="button" aria-label={removeLabel} onClick={onRemove} className="inline-flex size-5 items-center justify-center rounded-[var(--radius-control)] hover:bg-[var(--color-brand-500)]/20 focus-visible:outline-2 focus-visible:outline-[var(--color-brand-500)]">
          <span aria-hidden="true" className="text-sm leading-none">×</span>
        </button>
      </ActionTooltip>
    </span>
  );
}
