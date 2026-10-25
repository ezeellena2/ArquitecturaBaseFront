import { cloneElement, useId, type ReactElement, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { ActionTooltip } from "./ActionTooltip";

/// Lo que `FormField` le pone a su control; se reenvía al control envuelto.
interface FieldProps {
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/// El motivo de un control deshabilitado, cuando no es obvio: tooltip al pasar el mouse o con el foco y descripción
/// accesible del control. Sin textos al lado ni debajo, así el control no cambia de lugar ni de forma.
///
/// Un control deshabilitado no recibe foco ni puntero; por eso lo envuelve un span enfocable, como `IconButton` con
/// `disabledLabel`. El consumidor pasa `reason` solo cuando el control está deshabilitado por ese motivo: no mientras
/// trabaja ni en ítems de menú, que muestran su motivo adentro. Sin motivo, devuelve el control solo.
///
/// El envoltorio toma el ancho de su control, como un botón. Un control que ocupa todo el ancho de su campo pasa
/// `className="grid w-full"`, así no se achica al ancho propio del control cuando está deshabilitado: la grilla estira
/// al control aunque tenga su propio contenedor (un `Autocomplete`), y `flex w-full` sólo alcanza con un `Input` directo.
/// Un botón de un `DialogFooter`, que en el celular apila sus botones a todo el ancho, pasa `className="max-sm:*:flex-1"`:
/// el envoltorio ya se estira con el pie, y así el botón conserva ese ancho.
export function DisabledReason({ reason, className, children, ...field }: FieldProps & {
  reason?: string | null;
  className?: string;
  children: ReactElement<FieldProps>;
}): ReactNode {
  const reasonId = useId();
  if (!reason) return cloneElement(children, field);
  const describedBy = [field["aria-describedby"] ?? children.props["aria-describedby"], reasonId].filter(Boolean).join(" ");
  return (
    <ActionTooltip label={reason}>
      <span tabIndex={0} className={cn("inline-flex max-w-full", className)}>
        {cloneElement(children, { ...field, "aria-describedby": describedBy })}
        <span id={reasonId} hidden>{reason}</span>
      </span>
    </ActionTooltip>
  );
}
