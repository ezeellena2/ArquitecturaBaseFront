import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/// Estado vacío de listados y páginas (sección 7.4).
///
/// `className` es para el vacío que vive adentro de una tarjeta que ya tiene su borde, como el del selector de
/// permisos: ahí el recuadro punteado sería una caja dentro de otra. `descriptionClassName`, para ponerle un ancho
/// máximo al motivo cuando repite lo que escribió el usuario: en una tarjeta ancha, una búsqueda larga lo
/// estiraría de punta a punta en una sola línea.
export function EmptyState({
  title,
  description,
  action,
  className,
  descriptionClassName,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  descriptionClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] p-10 text-center",
        className,
      )}
    >
      <h3 className="text-base font-medium">{title}</h3>
      {description ? (
        <p className={cn("text-sm text-[var(--color-content-muted)]", descriptionClassName)}>{description}</p>
      ) : null}
      {action}
    </div>
  );
}
