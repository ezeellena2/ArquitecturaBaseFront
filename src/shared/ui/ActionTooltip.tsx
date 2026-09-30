import type { ComponentProps, ReactElement } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/// El rótulo llega traducido; el nombre accesible sigue en el control. El portal evita recortes por overflow.
export function ActionTooltip({ label, children, side = "top" }: {
  label: string;
  children: ReactElement;
  side?: ComponentProps<typeof TooltipContent>["side"];
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={6} collisionPadding={8}>{label}</TooltipContent>
    </Tooltip>
  );
}
