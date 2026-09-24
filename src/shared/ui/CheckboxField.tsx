import { useId, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { Checkbox } from "./checkbox";
import { Label } from "./label";

interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /// Línea de ayuda debajo de la etiqueta.
  description?: string;
  /// Va debajo de la ayuda, sin reemplazarla: el error dice qué falta y la ayuda, por qué hace falta ("Sin esto,
  /// WhatsApp no permite escribirle primero"). Es lo que distingue a una casilla de un `FormField`.
  error?: string;
  disabled?: boolean;
}

/// Una casilla con su etiqueta al lado. `FormField` pone la etiqueta arriba del control, que para una casilla
/// no sirve: acá van en la misma fila, atadas por el id, así la etiqueta es el nombre accesible de la casilla
/// y hacerle clic la marca.
///
/// La fila es la del selector de permisos del tablero ("Roles · Editar un rol"): se ilumina entera al pasar el
/// mouse, así que tiene que marcarse entera al hacerle clic. Para eso el `after` de la etiqueta se estira sobre
/// toda la fila, en vez de meter la ayuda adentro del `<label>`: ahí dejaría de ser la descripción y pasaría a
/// ser parte del nombre accesible.
export function CheckboxField({
  label,
  checked,
  onCheckedChange,
  description,
  error,
  disabled,
}: CheckboxFieldProps): ReactNode {
  const id = useId();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const describedBy = [description ? descriptionId : undefined, error ? errorId : undefined].filter(Boolean).join(" ");

  return (
    <div
      className={cn(
        "relative flex items-start gap-2.5 rounded-[var(--radius-control)] px-2.5 py-[9px]",
        disabled ? "" : "hover:bg-[var(--color-surface-muted)]",
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : undefined}
        // Radix informa `boolean | "indeterminate"`; acá solo hay marcada o no.
        onCheckedChange={(value) => onCheckedChange(value === true)}
        // Sin marcar, el borde de `--color-border` casi no se ve sobre blanco: una casilla vacía tiene que
        // leerse como algo que se puede marcar, como la del tablero.
        className="mt-px border-[var(--color-content-muted)]"
      />
      <div className="flex flex-col gap-0.5">
        <Label
          htmlFor={id}
          className={cn(
            "text-[13.5px] leading-[1.2]",
            disabled ? "text-[var(--color-content-muted)]" : "cursor-pointer after:absolute after:inset-0",
          )}
        >
          {label}
        </Label>
        {description ? (
          <p id={descriptionId} className="text-[12.5px] leading-[1.4] text-[var(--color-content-muted)]">
            {description}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} role="alert" className="text-sm text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
