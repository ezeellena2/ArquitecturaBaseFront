import type { ComponentProps, ReactNode } from "react";
import { Button } from "./button";
import { ActionTooltip } from "./ActionTooltip";

/// Botón que solo muestra un ícono: el nombre accesible es obligatorio.
export function IconButton({
  label,
  disabledLabel,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "aria-label" | "title"> & { label: string; disabledLabel?: string }): ReactNode {
  const button = (
    <Button type="button" variant="ghost" size="icon" aria-label={label} {...props}>
      {children}
    </Button>
  );
  return (
    <ActionTooltip label={props.disabled ? (disabledLabel ?? label) : label}>
      {props.disabled ? <span tabIndex={0} aria-label={label} className="inline-flex">{button}</span> : button}
    </ActionTooltip>
  );
}
