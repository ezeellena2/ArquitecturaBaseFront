import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export interface SegmentedOption {
  key: string;
  label: ReactNode;
  pressed: boolean;
  onSelect: () => void;
}

/// Un segmentado: pocas opciones fijas, a la vista y de un clic, en vez de un desplegable que pide dos. Lo usan
/// el estado del listado de usuarios, el "Todos | Elegidos" del selector de permisos y el "Correo | WhatsApp" de
/// la pantalla de ingreso.
///
/// Son botones con `aria-pressed` y no un grupo de radios porque cada uno actúa al apretarse, no al enviarse
/// un formulario. El nombre del grupo es obligatorio: sin él, el lector anuncia botones sueltos ("Todos",
/// "Activos") y no dice qué están eligiendo.
///
/// `fullWidth` lo estira al ancho de su contenedor, en partes iguales: es la forma que tiene en una tarjeta
/// angosta, como la del ingreso, donde el segmentado encabeza el formulario. Sin eso, mide lo que sus textos.
export function SegmentedControl({
  options,
  fullWidth = false,
  appearance = "compact",
  "aria-label": label,
}: {
  options: readonly SegmentedOption[];
  fullWidth?: boolean;
  appearance?: "compact" | "public";
  "aria-label": string;
}): ReactNode {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        appearance === "public" ? "access-channel" : cn("shrink-0 divide-x divide-[var(--color-border)] overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] h-[var(--height-control)]"),
        appearance === "public" ? undefined : fullWidth ? "flex w-full" : "inline-flex",
      )}
    >
      {options.map((option) => (
        <button
          key={option.key}
          // Sin `type`, adentro de un formulario (el editor de un rol) el botón lo enviaría.
          type="button"
          aria-pressed={option.pressed}
          onClick={option.onSelect}
          className={cn(
            // El contorno de foco va hacia adentro: el grupo recorta lo que sale de su borde.
            appearance === "public" ? undefined : cn("px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-brand-500)] whitespace-nowrap"),
            fullWidth ? "flex-1" : "",
            appearance === "public" ? undefined : option.pressed
              ? "bg-[var(--color-brand-50)] text-[var(--color-brand-700)]"
              : "text-[var(--color-content-muted)] hover:bg-[var(--color-surface-muted)]",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
