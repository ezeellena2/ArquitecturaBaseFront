import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/utils";

/// La superficie común de búsquedas y filtros. Cada listado compone sus controles adentro,
/// pero el tono, el borde y el espacio interior se deciden una sola vez para toda la plantilla.
export function FilterBar({ className, ...props }: ComponentProps<"div">) {
  return <div
    data-slot="filter-bar"
    className={cn("mb-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-filter-surface)] px-4 py-3.5", className)}
    {...props}
  />;
}
