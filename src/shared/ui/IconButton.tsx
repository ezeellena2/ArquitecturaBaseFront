import type { ComponentProps, ReactNode } from "react";
import { Button } from "./button";
import { ActionTooltip } from "./ActionTooltip";

/// Botón que solo muestra un ícono: el nombre accesible es obligatorio. Mientras su acción trabaja (`pending`), el
/// aro reemplaza al dibujo y el dueño pasa en `label` lo que hace («Descargando el PDF»).
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
  return (
    <ActionTooltip label={props.disabled && !pending ? (disabledLabel ?? label) : label}>
      {off ? <span tabIndex={0} aria-label={label} className="inline-flex">{button}</span> : button}
    </ActionTooltip>
  );
}
