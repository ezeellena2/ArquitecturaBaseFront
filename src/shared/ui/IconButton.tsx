import type { ComponentProps, ReactNode } from "react";
import { Button } from "./button";
import { ActionTooltip } from "./ActionTooltip";
import { DisabledReason } from "./DisabledReason";

/// Botón que solo muestra un ícono: el nombre accesible es obligatorio. Mientras su acción trabaja (`pending`), el
/// aro reemplaza al dibujo y el dueño pasa en `label` lo que hace («Descargando el PDF»). Apagado con `disabledLabel`,
/// conserva su nombre y el motivo es su tooltip y su descripción, como en `DisabledReason` (MA1-A).
export function IconButton({
  label,
  disabledLabel,
  pending = false,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "aria-label" | "title"> & { label: string; disabledLabel?: string }): ReactNode {
  const off = props.disabled || pending;
  const button = (
    <Button type="button" variant="ghost" size="icon" aria-label={label} pending={pending} {...props}>
      {pending ? null : children}
    </Button>
  );
  if (props.disabled && !pending && disabledLabel) return <DisabledReason reason={disabledLabel}>{button}</DisabledReason>;
  return (
    <ActionTooltip label={label}>
      {off ? <span tabIndex={0} aria-label={label} className="inline-flex">{button}</span> : button}
    </ActionTooltip>
  );
}
