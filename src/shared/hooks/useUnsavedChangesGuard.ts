import { useCallback, useEffect, useRef } from "react";
import {
  type BlockerFunction,
  useBeforeUnload,
  useBlocker,
} from "react-router";

export interface UnsavedChangesGuard {
  /// Hay una salida frenada esperando respuesta: es cuando la pantalla muestra "¿Descartar los cambios?".
  readonly isBlocked: boolean;
  /// Se queda en la pantalla, con lo escrito. Va en el `onOpenChange(false)` del diálogo, así también se
  /// queda al cerrarlo con Escape o afuera.
  readonly stay: () => void;
  /// Sale, y lo escrito se pierde. Va en el `onConfirm` del diálogo.
  readonly leave: () => void;
  /// Deja pasar la próxima navegación sin preguntar. La usa el guardado antes de volver al listado: lo
  /// guardado ya no se pierde.
  readonly allowNextNavigation: () => void;
}

// Las guardas montadas que tienen cambios sin guardar. Cambiar el idioma del menú no pasa por el router, pero
// vuelve a montar los editores: el menú pregunta con `hasUnsavedChanges` antes de cambiarlo.
const dirtyGuards = new Set<object>();

/// Si alguna pantalla montada tiene cambios sin guardar. La usa el menú del usuario antes de cambiar el idioma.
export function hasUnsavedChanges(): boolean {
  return dirtyGuards.size > 0;
}

/// Frena la salida de una pantalla con cambios sin guardar. Las del router (un enlace, las migas, el menú, el
/// Atrás del navegador) las frena `useBlocker` y la pantalla pregunta con su `ConfirmDialog`; recargar o
/// cerrar la pestaña no pasan por el router, así que ahí pregunta el navegador (`useBeforeUnload`).
///
/// Por defecto sólo frena `pathname`. `queryKeys` permite frenar la identidad de una conversación
/// en la misma ruta sin bloquear cambios de paginado o filtros.
export function useUnsavedChangesGuard(
  isDirty: boolean,
  queryKeys: readonly string[] = [],
): UnsavedChangesGuard {
  const allowNextRef = useRef(false);
  const leavingRef = useRef(false);

  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) => {
      if (allowNextRef.current) {
        allowNextRef.current = false;

        return false;
      }

      return (
        isDirty &&
        (currentLocation.pathname !== nextLocation.pathname ||
          queryKeys.some(
            (key) =>
              new URLSearchParams(currentLocation.search).get(key) !==
              new URLSearchParams(nextLocation.search).get(key),
          ))
      );
    },
    [isDirty, queryKeys],
  );

  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (blocker.state === "unblocked") {
      leavingRef.current = false;
    }
  }, [blocker.state]);

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const guard = {};
    dirtyGuards.add(guard);

    return () => {
      dirtyGuards.delete(guard);
    };
  }, [isDirty]);

  useBeforeUnload(
    useCallback(
      (event: BeforeUnloadEvent) => {
        if (isDirty) {
          event.preventDefault();
        }
      },
      [isDirty],
    ),
  );

  return {
    isBlocked: blocker.state === "blocked",
    stay: () => {
      // `ConfirmDialog` llama a `onConfirm` y enseguida a `onOpenChange(false)`, en el mismo clic, así que
      // después de "Descartar" también llega acá, con el `blocker` del render anterior, todavía "blocked".
      // Su `reset()` no valida la transición: pisaría el "proceeding". Con el Atrás, `proceed()` vuelve a
      // mover el historial más tarde; si antes corrió un `reset()`, la salida se evalúa de nuevo con los
      // cambios puestos, "Descartar" no sale y el diálogo reaparece.
      if (leavingRef.current) {
        return;
      }

      if (blocker.state === "blocked") {
        blocker.reset();
      }
    },
    leave: () => {
      if (blocker.state === "blocked") {
        leavingRef.current = true;
        blocker.proceed();
      }
    },
    allowNextNavigation: () => {
      allowNextRef.current = true;
    },
  };
}
