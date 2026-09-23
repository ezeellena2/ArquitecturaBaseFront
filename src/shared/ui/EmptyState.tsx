import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/// Estado vacío de listados y páginas (sección 7.4).
///
/// `className` es para el vacío que vive adentro de una tarjeta que ya tiene su borde, como el del selector de
/// permisos: ahí el recuadro punteado sería una caja dentro de otra.
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] p-10 text-center",
        className,
      )}
    >
      <h3 className="text-base font-medium">{title}</h3>
      {description ? <p className="text-sm text-[var(--color-content-muted)]">{description}</p> : null}
      {action}
    </div>
  );
}
