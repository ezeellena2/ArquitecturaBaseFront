import type { ReactNode } from "react";

/// Estado vacío de listados y páginas (sección 7.4).
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] p-10 text-center">
      <h3 className="text-base font-medium">{title}</h3>
      {description ? <p className="text-sm text-[var(--color-content-muted)]">{description}</p> : null}
      {action}
    </div>
  );
}
