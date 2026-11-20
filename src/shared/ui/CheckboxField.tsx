import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import { Badge } from "./badge";
import { Checkbox } from "./checkbox";
import { DisabledReason } from "./DisabledReason";
import { InfoTip } from "./InfoTip";
import { Label } from "./label";

interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /// Un dato debajo de la etiqueta (un conteo). Una explicación de la casilla no va acá sino en `help`.
  description?: string;
  /// La explicación de la casilla: en la (i) al final de su texto, con su tooltip (tablero LC3). Tocarla no la marca.
  help?: string;
  /// Un estado de lo que se marca, en una etiqueta junto a su texto y sin nada debajo: «Borrador» en un formulario que todavía
  /// no se publicó (CM2). Es parte de la descripción accesible de la casilla.
  tag?: string;
  /// Va debajo de la ayuda, sin reemplazarla: el error dice qué falta y la ayuda, por qué hace falta ("Sin esto,
  /// WhatsApp no permite escribirle primero"). Es lo que distingue a una casilla de un `FormField`.
  error?: string;
  disabled?: boolean;
  /// Por qué está apagada, cuando no es obvio: tooltip y descripción accesible de la casilla (`DisabledReason`), sin
  /// texto debajo. Sólo cuenta mientras está apagada, y responde la fila entera: pasar por su texto, hacerle clic o
  /// tocarlo muestra el motivo arriba del cuadradito y no la marca (MA1-A).
  disabledReason?: string | null;
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
  help,
  tag,
  error,
  disabled,
  disabledReason,
}: CheckboxFieldProps): ReactNode {
  const { t } = useTranslation();
  const id = useId();
  const descriptionId = `${id}-description`;
  const helpId = `${id}-help`;
  const tagId = `${id}-tag`;
  const errorId = `${id}-error`;
  const describedBy = [help ? helpId : undefined, tag ? tagId : undefined, description ? descriptionId : undefined, error ? errorId : undefined].filter(Boolean).join(" ");
  const labelNode = (
    <Label
      htmlFor={id}
      className={cn(
        "text-[0.84375rem] leading-[1.2]",
        disabled ? "text-[var(--color-content-muted)]" : "cursor-pointer after:absolute after:inset-0",
      )}
    >
      {label}
    </Label>
  );

  return (
    <div
      className={cn(
        "relative flex items-start gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2.25",
        disabled ? "" : "hover:bg-[var(--color-surface-muted)]",
      )}
    >
      {/* Con motivo, el envoltorio del cuadradito se estira sobre la fila, como la etiqueta de una casilla encendida:
          la fila entera muestra el motivo, que se ancla en el cuadradito. */}
      <DisabledReason reason={disabled ? disabledReason : null} className="after:absolute after:inset-0">
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
      </DisabledReason>
      <div className="flex flex-col gap-0.5">
        {help || tag ? (
          <span className="flex items-center gap-1">
            {labelNode}
            {tag ? <Badge id={tagId} variant="outline">{tag}</Badge> : null}
            {/* Encima del área de la etiqueta que se estira sobre la fila: tocar la (i) abre su ayuda y no marca la casilla. */}
            {help ? <span className="-my-1 inline-flex"><InfoTip id={helpId} text={help} label={t("actions.moreInfo", { label })} /></span> : null}
          </span>
        ) : labelNode}
        {description ? (
          <p id={descriptionId} className="text-[0.78125rem] leading-[1.4] text-[var(--color-content-muted)]">
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
