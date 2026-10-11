import type { ReactNode } from "react";

// Presentational attachment: callers supply authorized, localized metadata and content.
export function MessageCard({ icon, title, description, children }: { icon?: ReactNode; title: string; description: string; children?: ReactNode }) {
  return <div className="mt-2 min-w-0 overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)]">
    <div className="flex min-w-0 items-start gap-2 px-3 py-2">
      {icon ? <span className="mt-0.5 shrink-0" aria-hidden="true">{icon}</span> : null}
      <div className="min-w-0"><p className="break-words text-sm font-semibold">{title}</p><p className="break-words text-xs text-[var(--color-content-muted)]">{description}</p></div>
    </div>
    {children}
  </div>;
}
