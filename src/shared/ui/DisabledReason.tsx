import { cloneElement, useId, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { ActionTooltip } from "./ActionTooltip";
import { Button } from "./button";
import { Checkbox } from "./checkbox";

/// Lo que `FormField` le pone a su control; se reenvía al control envuelto.
interface FieldProps {
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/// Lo que se lee del control envuelto para apagarlo y nombrar su envoltorio.
interface ControlProps extends FieldProps {
  disabled?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

/// Un botón y una casilla siguen en el Tab, con su nombre y «no disponible»; un campo o un grupo, no.
const pressable = (control: ReactElement) => control.type === Button || control.type === Checkbox || control.type === "button";

/// El clic sólo muestra el motivo: no llama a `onClick`, no envía el formulario de un `submit` y no marca una casilla,
/// porque Radix saltea su cambio después de un `preventDefault`.
const showOnly = (event: MouseEvent) => event.preventDefault();

/// El motivo de un control apagado, cuando no es obvio (MA1-A, 2026-11-09): un tooltip sobre el control, que se abre al
/// pasar el mouse, con el foco, con un clic o con un toque, y la descripción accesible del control. Sin textos ni íconos
/// al lado ni debajo, así el control no cambia de lugar ni de forma.
///
/// Un botón o una casilla quedan con `aria-disabled` en lugar de `disabled`: se alcanzan con Tab y el lector dice su
/// nombre, que no están disponibles y el motivo; el clic, Enter y Espacio sólo muestran el motivo. Su envoltorio es la
/// zona del puntero, sin foco ni rol, porque el control apagado no recibe el puntero (`aria-disabled:pointer-events-none`
/// de `Button` y `Checkbox`). Un campo deshabilitado no recibe el foco: lo recibe el envoltorio, nombrado por la etiqueta
/// de su `FormField` (o por el nombre del control) y descrito por el motivo.
///
/// El consumidor pasa `reason` sólo cuando el control está apagado por ese motivo: no mientras trabaja ni en ítems de
/// menú, que muestran su motivo adentro. Sin motivo, devuelve el control solo.
///
/// El envoltorio toma el ancho de su control, como un botón. Un control que ocupa todo el ancho de su campo pasa
/// `className="grid w-full"`, así no se achica al ancho propio del control cuando está apagado: la grilla estira
/// al control aunque tenga su propio contenedor (un `Autocomplete`), y `flex w-full` sólo alcanza con un `Input` directo.
/// Un botón de un `DialogFooter`, que en el celular apila sus botones a todo el ancho, pasa `className="max-sm:*:flex-1"`:
/// el envoltorio ya se estira con el pie, y así el botón conserva ese ancho.
export function DisabledReason({ reason, className, children, ...field }: FieldProps & {
  reason?: string | null;
  className?: string;
  children: ReactElement<ControlProps>;
}): ReactNode {
  const reasonId = useId();
  if (!reason) return cloneElement(children, field);
  const describedBy = [field["aria-describedby"] ?? children.props["aria-describedby"], reasonId].filter(Boolean).join(" ");
  const text = <span id={reasonId} hidden>{reason}</span>;
  if (pressable(children)) {
    return (
      <ActionTooltip informative label={reason}>
        <span className={cn("inline-flex max-w-full", className)}>
          {cloneElement(children, { ...field, disabled: false, "aria-disabled": true, "aria-describedby": describedBy, onClick: showOnly } as ControlProps)}
          {text}
        </span>
      </ActionTooltip>
    );
  }
  const labelledBy = field.id ? `${field.id}-label` : children.props["aria-labelledby"];
  const label = labelledBy ? undefined : children.props["aria-label"];
  return (
    <ActionTooltip informative label={reason}>
      <span
        tabIndex={0}
        role={labelledBy || label ? "group" : undefined}
        aria-labelledby={labelledBy}
        aria-label={label}
        aria-describedby={reasonId}
        className={cn("inline-flex max-w-full", className)}
      >
        {cloneElement(children, { ...field, "aria-describedby": describedBy })}
        {text}
      </span>
    </ActionTooltip>
  );
}
