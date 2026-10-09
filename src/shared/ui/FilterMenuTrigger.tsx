import type { ComponentProps } from "react";
import { DropdownMenuTrigger } from "./dropdown-menu";
import { Button } from "./button";

// El disparador de un filtro hereda exactamente el botón secundario común.
export function FilterMenuTrigger({ children, ...props }: Omit<ComponentProps<typeof DropdownMenuTrigger>, "className" | "style" | "asChild">) {
  return <DropdownMenuTrigger {...props} asChild><Button type="button" variant="outline">{children}</Button></DropdownMenuTrigger>;
}
