import { cloneElement, useId, type ReactElement, type ReactNode } from "react";
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
export function DisabledReason({ reason, children, ...field }: FieldProps & {
  reason?: string | null;
  children: ReactElement<FieldProps>;
}): ReactNode {
  const reasonId = useId();
  if (!reason) return cloneElement(children, field);
  const describedBy = [field["aria-describedby"] ?? children.props["aria-describedby"], reasonId].filter(Boolean).join(" ");
  return (
    <ActionTooltip label={reason}>
      <span tabIndex={0} className="inline-flex max-w-full">
        {cloneElement(children, { ...field, "aria-describedby": describedBy })}
        <span id={reasonId} hidden>{reason}</span>
      </span>
    </ActionTooltip>
  );
}
