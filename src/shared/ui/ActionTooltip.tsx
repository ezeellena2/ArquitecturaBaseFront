import { useCallback, useRef, useState, type ComponentProps, type FocusEvent, type ReactElement } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

type Side = ComponentProps<typeof TooltipContent>["side"];

/// El rótulo llega traducido; el nombre accesible sigue en el control. El portal evita recortes por overflow.
///
/// `informative` es lo que sólo informa, el motivo de algo apagado y la (i) (MA1-A, 2026-11-09): además de con el mouse y
/// con el foco, se abre con un clic, un toque, Enter o Espacio, y queda abierto hasta Escape, salir con el mouse, perder
/// el foco o tocar afuera. El tooltip de una acción, como el nombre de un botón de ícono, no cambia: tocarlo hace la acción.
///
/// Los dos se abren con el foco del teclado, no con el que un diálogo devuelve por código después de un clic (O2,
/// 2026-11-24): ahí el nombre del lápiz de una fila tapaba el lápiz de la fila de arriba y se llevaba su primer clic.
export function ActionTooltip({ label, children, side = "top", informative = false }: {
  label: string;
  children: ReactElement;
  side?: Side;
  informative?: boolean;
}) {
  if (informative) return <InformativeTooltip label={label} side={side}>{children}</InformativeTooltip>;
  return (
    <Tooltip>
      <TooltipTrigger asChild onFocus={openWithKeyboardFocus}>{children}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={6} collisionPadding={8}>{label}</TooltipContent>
    </Tooltip>
  );
}

/// Con qué se interactuó por última vez, el teclado o un puntero (mouse, toque o lápiz), como el `:focus-visible` del
/// navegador. Lo escucha el documento antes que nadie. No se usa `:focus-visible`: jsdom lo aproxima y no lo marca al pasar
/// con Tab de un botón a otro.
let lastInput: "keyboard" | "pointer" = "keyboard";
if (typeof document !== "undefined") {
  document.addEventListener("keydown", (event) => { if (!event.altKey && !event.ctrlKey && !event.metaKey) lastInput = "keyboard"; }, true);
  document.addEventListener("pointerdown", () => { lastInput = "pointer"; }, true);
}

/// Un foco después de un clic, como el que un diálogo devuelve a su disparador, no lo abre: `preventDefault` saltea la
/// apertura que Radix compone después del manejador dado. Con el mouse ya se abre al pasar por encima, y el motivo de lo
/// apagado, con un clic.
function openWithKeyboardFocus(event: FocusEvent<HTMLElement>) {
  if (lastInput === "pointer") event.preventDefault();
}

/// Radix no abre un tooltip con un toque y lo cierra con el `pointerdown` y el clic de su disparador. Acá el estado es
/// propio: el clic lo abre, y `preventDefault` saltea esos cierres, que Radix compone después de los manejadores dados.
function InformativeTooltip({ label, children, side }: { label: string; children: ReactElement; side: Side }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  // El disparador puede ser un botón o el envoltorio de `DisabledReason`.
  const setTrigger = useCallback((node: HTMLElement | null) => { trigger.current = node; }, []);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        asChild
        ref={setTrigger}
        onFocus={openWithKeyboardFocus}
        onPointerDown={(event) => event.preventDefault()}
        onClick={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          // Un botón convierte la tecla en un clic; un envoltorio enfocable, no, y Espacio desplazaría la página.
          if (!(event.currentTarget instanceof HTMLButtonElement)) event.preventDefault();
          setOpen(true);
        }}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={6}
        collisionPadding={8}
        // Tocar otra vez el control no lo cierra: para Radix es tocar afuera del tooltip.
        onPointerDownOutside={(event) => {
          if (event.target instanceof Node && trigger.current?.contains(event.target)) event.preventDefault();
        }}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
