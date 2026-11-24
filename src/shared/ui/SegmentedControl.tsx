import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export interface SegmentedOption {
  key: string;
  label: ReactNode;
  pressed: boolean;
  onSelect: () => void;
}

/// Un segmentado: pocas opciones fijas, a la vista y de un clic. Desde el 2026-11-22, por decisión del usuario, no lo
/// usa ningún campo ni filtro de la app: todo lo que se elige va en `Picker` (DS1-A), también los filtros de los
/// listados y la carga de un formulario. Queda para la vista previa de un catálogo (`CatalogPreview`), donde "Una
/// opción | Varias" sólo cambia la ilustración de cómo se ve en WhatsApp, para el catálogo de la biblioteca y, con
/// `appearance="public"`, para «Ingresar con» del acceso. Para elegir un dato no se usa.
///
/// `appearance="public"` es la elección del canal del acceso, con subrayado (`.access-channel` de `index.css`): los
/// botones van sueltos, con su ícono, y el elegido lleva la línea y el color de la marca. «Ingresar con» pasó a la pieza
/// el 2026-11-22 y el 2026-11-24 el usuario pidió volverlo a como estaba diseñado: es una excepción de la regla, como
/// las vistas previas que imitan WhatsApp.
///
/// El 2026-11-23 se retiraron las variantes que habían quedado sin consumidores: las opciones que bajan de renglón
/// (`wrap`), el ancho completo (`fullWidth`), apagarlo entero (`disabled`) y el motivo de una opción apagada
/// (`disabledReason`).
///
/// Son botones con `aria-pressed` y no un grupo de radios porque cada uno actúa al apretarse, no al enviarse
/// un formulario. El nombre del grupo es obligatorio: sin él, el lector anuncia botones sueltos ("Todos",
/// "Activos") y no dice qué están eligiendo.
///
/// La elegida va rellena con el color de los botones y su texto en blanco o negro, el que más contraste dé (OE1-A,
/// 2026-11-03); las otras quedan blancas. Antes era un verde casi blanco sobre blanco y no se sabía cuál estaba elegida,
/// sobre todo en un Sí o no. En el celular cada opción mide al menos 44 × 44 px.
///
/// Dentro de un `FormField` recibe el id, la marca de inválido y la descripción (la (i) y el error), y su etiqueta dice lo
/// mismo que el `aria-label`, que es el que nombra al grupo.
export function SegmentedControl({
  options,
  appearance = "compact",
  id,
  "aria-label": label,
  "aria-invalid": invalid,
  "aria-describedby": describedBy,
}: {
  options: readonly SegmentedOption[];
  appearance?: "compact" | "public";
  id?: string;
  "aria-label": string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}): ReactNode {
  return (
    <div
      id={id}
      role="group"
      aria-label={label}
      aria-invalid={invalid}
      aria-describedby={describedBy}
      // Sin `overflow-hidden`: el contorno de foco va por fuera de la opción y el grupo no tiene que recortarlo.
      className={appearance === "public" ? "access-channel"
        : "inline-flex h-[var(--height-control)] shrink-0 divide-x divide-[var(--color-border)] rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] max-sm:h-11"}
    >
      {options.map((option) => (
        <button
          key={option.key}
          // Sin `type`, adentro de un formulario (el editor de un rol) el botón lo enviaría.
          type="button"
          aria-pressed={option.pressed}
          onClick={option.onSelect}
          // En el acceso, `.access-channel` dibuja los botones y el subrayado del elegido.
          className={appearance === "public" ? undefined : cn(
            // El contorno de foco va por fuera y separado: adentro no se vería sobre la opción pintada. Sube sobre las
            // vecinas para que ninguna lo tape. Las esquinas de la primera y la última siguen la curva del borde.
            "whitespace-nowrap px-3 text-sm transition-colors focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-500)] first:rounded-l-[calc(var(--radius-control)-1px)] last:rounded-r-[calc(var(--radius-control)-1px)] max-sm:min-w-11",
            option.pressed
              ? "bg-[var(--color-brand-600)] font-semibold text-[var(--color-brand-ink)]"
              : "font-medium text-[var(--color-content)] hover:bg-[var(--color-surface-muted)]",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
