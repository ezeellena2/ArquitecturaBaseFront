import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { DisabledReason } from "./DisabledReason";

export interface SegmentedOption {
  key: string;
  label: ReactNode;
  pressed: boolean;
  onSelect: () => void;
  /// Por qué la opción no está disponible: queda apagada, con el motivo sobre ella (MA1-A).
  disabledReason?: string;
}

/// Un segmentado: pocas opciones fijas, a la vista y de un clic. Desde el 2026-11-22 un campo de formulario ya no lo usa:
/// elegir entre pocas opciones fijas va en `Picker`, como cualquier lista (DS1-A, en toda la app). Queda para los filtros
/// con cantidades de los listados (el estado del listado de usuarios, el de formularios), el "Todos | Elegidos" del
/// selector de permisos y el "Correo | WhatsApp" de la pantalla de ingreso.
///
/// Son botones con `aria-pressed` y no un grupo de radios porque cada uno actúa al apretarse, no al enviarse
/// un formulario. El nombre del grupo es obligatorio: sin él, el lector anuncia botones sueltos ("Todos",
/// "Activos") y no dice qué están eligiendo.
///
/// `fullWidth` lo estira al ancho de su contenedor, en partes iguales: es la forma que tiene en una tarjeta
/// angosta, como la del ingreso, donde el segmentado encabeza el formulario. Sin eso, mide lo que sus textos.
///
/// `disabled` apaga todas las opciones mientras su dueño trabaja, como el origen de una importación que revisa. Una opción
/// sola se apaga con `disabledReason`, que dice por qué, como la delegación de ARCA sin la plataforma configurada.
///
/// La elegida va rellena con el color de los botones y su texto en blanco o negro, el que más contraste dé (OE1-A,
/// 2026-11-03); las otras quedan blancas. Antes era un verde casi blanco sobre blanco y no se sabía cuál estaba elegida,
/// sobre todo en un Sí o no. En el celular cada opción mide al menos 44 × 44 px.
///
/// Dentro de un `FormField` recibe el id, la marca de inválido y la descripción (la (i) y el error), y su etiqueta dice lo
/// mismo que el `aria-label`, que es el que nombra al grupo.
export function SegmentedControl({
  options,
  fullWidth = false,
  appearance = "compact",
  disabled = false,
  wrap = false,
  id,
  "aria-label": label,
  "aria-invalid": invalid,
  "aria-describedby": describedBy,
}: {
  options: readonly SegmentedOption[];
  fullWidth?: boolean;
  appearance?: "compact" | "public";
  disabled?: boolean;
  /// En el celular, las opciones van separadas y la que no entra baja de renglón; desde 640 px, unidas como siempre. Es para
  /// opciones de textos largos que no entran juntas en un teléfono, como «Dónde se completa» (SA1-A, 2026-11-09). Una opción
  /// más larga que el renglón ocupa todo el ancho y corta su texto en renglones, sin pasarse de su caja (2026-11-11).
  /// `"always"` las separa en todos los anchos, para una columna angosta también en la compu: los filtros de la bandeja del
  /// chat, donde «Necesita una persona» baja de renglón (AS4, 2026-11-12).
  wrap?: boolean | "always";
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
      className={cn(
        // Sin `overflow-hidden`: el contorno de foco va por fuera de la opción y el grupo no tiene que recortarlo.
        appearance === "public" ? "access-channel" : wrap === "always" ? "flex flex-wrap gap-1.5" : wrap
          ? "flex flex-wrap gap-1.5 sm:inline-flex sm:flex-nowrap sm:gap-0 sm:divide-x sm:divide-[var(--color-border)] sm:rounded-[var(--radius-control)] sm:border sm:border-[var(--color-border)] sm:bg-[var(--color-surface)] sm:h-[var(--height-control)]"
          : cn("shrink-0 divide-x divide-[var(--color-border)] rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] h-[var(--height-control)] max-sm:h-11"),
        appearance === "public" || wrap ? undefined : fullWidth ? "flex w-full" : "inline-flex",
      )}
    >
      {options.map((option) => {
        const button = (
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
            // Separada en el celular, cada opción lleva su borde; la elegida, el de su relleno. Mide al menos 44 px de alto y, si su
            // texto no entra en el renglón, toma todo el ancho y lo corta en renglones parejos: crece hacia abajo, nunca hacia el
            // costado.
            wrap === "always" && appearance !== "public" ? cn("min-h-[var(--height-control)] max-w-full rounded-[var(--radius-control)] border max-sm:min-h-11 max-sm:py-2 max-sm:whitespace-normal max-sm:text-balance", option.pressed ? "border-[var(--color-brand-600)]" : "border-[var(--color-border)] bg-[var(--color-surface)]")
              : wrap && appearance !== "public" ? cn("max-sm:min-h-11 max-sm:max-w-full max-sm:py-2 max-sm:whitespace-normal max-sm:text-balance max-sm:rounded-[var(--radius-control)] max-sm:border", option.pressed ? "max-sm:border-[var(--color-brand-600)]" : "max-sm:border-[var(--color-border)] max-sm:bg-[var(--color-surface)]") : "",
            appearance === "public" ? undefined : option.pressed
              ? "bg-[var(--color-brand-600)] font-semibold text-[var(--color-brand-ink)]"
              : "font-medium text-[var(--color-content)] enabled:hover:bg-[var(--color-surface-muted)] aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent",
          )}
        >
          {option.label}
        </button>
        );
        return option.disabledReason ? <DisabledReason key={option.key} reason={option.disabledReason}>{button}</DisabledReason> : button;
      })}
    </div>
  );
}
