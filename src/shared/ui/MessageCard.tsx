import type { ReactNode } from "react";

// Presentational attachment: callers supply authorized, localized metadata.
export function MessageCard({ icon, title, description }: { icon?: ReactNode; title: string; description: string }) {
  return <div className="mt-2 flex min-w-0 items-start gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
    {icon ? <span className="mt-0.5 shrink-0" aria-hidden="true">{icon}</span> : null}
    <div className="min-w-0"><p className="break-words text-sm font-semibold">{title}</p><p className="break-words text-xs text-[var(--color-content-muted)]">{description}</p></div>
  </div>;
}
