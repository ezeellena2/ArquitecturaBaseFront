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
///
/// `disabled` apaga todas las opciones mientras su dueño trabaja, como el origen de una importación que revisa.
///
/// La elegida va rellena con el color de los botones y su texto en blanco o negro, el que más contraste dé (OE1-A,
/// 2026-11-03); las otras quedan blancas. Antes era un verde casi blanco sobre blanco y no se sabía cuál estaba elegida,
/// sobre todo en un Sí o no. En el celular cada opción mide al menos 44 × 44 px.
export function SegmentedControl({
  options,
  fullWidth = false,
  appearance = "compact",
  disabled = false,
  "aria-label": label,
}: {
  options: readonly SegmentedOption[];
  fullWidth?: boolean;
  appearance?: "compact" | "public";
  disabled?: boolean;
  "aria-label": string;
}): ReactNode {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        // Sin `overflow-hidden`: el contorno de foco va por fuera de la opción y el grupo no tiene que recortarlo.
        appearance === "public" ? "access-channel" : cn("shrink-0 divide-x divide-[var(--color-border)] rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] h-[var(--height-control)] max-sm:h-11"),
        appearance === "public" ? undefined : fullWidth ? "flex w-full" : "inline-flex",
      )}
    >
      {options.map((option) => (
        <button
          key={option.key}
          // Sin `type`, adentro de un formulario (el editor de un rol) el botón lo enviaría.
          type="button"
          aria-pressed={option.pressed}
          disabled={disabled}
          onClick={option.onSelect}
          className={cn(
            // El contorno de foco va por fuera y separado: adentro no se vería sobre la opción pintada. Sube sobre las
            // vecinas para que ninguna lo tape. Las esquinas de la primera y la última siguen la curva del borde.
            appearance === "public" ? undefined : cn("px-3 text-sm transition-colors focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-500)] whitespace-nowrap first:rounded-l-[calc(var(--radius-control)-1px)] last:rounded-r-[calc(var(--radius-control)-1px)] disabled:cursor-not-allowed disabled:opacity-50 max-sm:min-w-11"),
            fullWidth ? "flex-1" : "",
            appearance === "public" ? undefined : option.pressed
              ? "bg-[var(--color-brand-600)] font-semibold text-[var(--color-brand-ink)]"
              : "font-medium text-[var(--color-content)] enabled:hover:bg-[var(--color-surface-muted)]",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
