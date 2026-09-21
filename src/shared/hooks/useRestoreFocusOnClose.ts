import { useLayoutEffect, useRef } from "react";

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
export function useRestoreFocusOnClose(open = true): (event: Event) => void {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
  }, [open]);

  return (event: Event) => {
    if (previouslyFocusedRef.current) {
      event.preventDefault();
      previouslyFocusedRef.current.focus();
    }
  };
}
