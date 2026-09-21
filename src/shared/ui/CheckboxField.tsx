import { useId, type ReactNode } from "react";
import { Checkbox } from "./checkbox";
import { Label } from "./label";

interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /// Línea de ayuda debajo de la etiqueta.
  description?: string;
  disabled?: boolean;
}

/// Una casilla con su etiqueta al lado. `FormField` pone la etiqueta arriba del control, que para una casilla
/// no sirve: acá van en la misma fila, atadas por el id, así la etiqueta es el nombre accesible de la casilla
/// y hacerle clic la marca.
export function CheckboxField({
  label,
  checked,
  onCheckedChange,
  description,
  disabled,
}: CheckboxFieldProps): ReactNode {
  const id = useId();
  const descriptionId = `${id}-description`;

  return (
    <div className="flex items-start gap-2">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        aria-describedby={description ? descriptionId : undefined}
        // Radix informa `boolean | "indeterminate"`; acá solo hay marcada o no.
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5"
      />
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id} className="font-normal">
          {label}
        </Label>
        {description ? (
          <p id={descriptionId} className="text-xs text-[var(--color-content-muted)]">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
