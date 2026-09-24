import { useLayoutEffect, useRef, type RefObject } from "react";

/// El Dialog de Radix solo le devuelve el foco a un `DialogTrigger` propio. Los nuestros los abre cualquier
/// botón de la pantalla (el "Nuevo usuario" del encabezado, el "Roles" de una fila), así que guardamos ese
/// elemento antes de que el diálogo se quede con el foco y se lo devolvemos al cerrar. Sin esto el foco cae
/// en `<body>` y el siguiente Tab arranca desde el principio del documento.
///
/// Layout effect y no efecto normal: tiene que leer el foco **antes** de que el diálogo se lo lleve, y ese
/// auto-foco de Radix corre en un efecto pasivo.
///
/// Devuelve el `onCloseAutoFocus` que hay que pasarle al `DialogContent`. `open` solo hace falta en los
/// diálogos que se quedan montados cerrados; los que se montan solo mientras están abiertos no lo pasan.
///
/// `fallback` es para cuando lo que hizo el diálogo se lleva el botón que lo abrió: al agregar el correo, la fila
/// ya no ofrece "Agregar correo". Un elemento que ya no está en la página, o que está deshabilitado, no toma el
/// foco, y el foco cae en `<body>` igual que sin este hook. Con `fallback`, va ahí.
export function useRestoreFocusOnClose(open = true, fallback?: RefObject<HTMLElement | null>): (event: Event) => void {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
  }, [open]);

  return (event: Event) => {
    const previous = previouslyFocusedRef.current;
    const target = previous !== null && !canTakeFocus(previous) && fallback?.current ? fallback.current : previous;

    if (target) {
      event.preventDefault();
      target.focus();
    }
  };
}

function canTakeFocus(element: HTMLElement): boolean {
  return element.isConnected && !element.matches(":disabled");
}
