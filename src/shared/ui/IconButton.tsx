import type { ComponentProps, ReactNode } from "react";
import { Button } from "./button";

/// Botón que solo muestra un ícono: el nombre accesible es obligatorio.
export function IconButton({
  label,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "aria-label"> & { label: string }): ReactNode {
  return (
    <Button type="button" variant="ghost" size="icon" aria-label={label} title={label} {...props}>
      {children}
    </Button>
  );
}
