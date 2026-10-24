import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
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

export interface UnsavedChangesGuardOptions {
  /// Claves de la query que, además de `pathname`, implican perder el editor (la identidad de una conversación),
  /// sin frenar cambios de paginado o filtros.
  readonly queryKeys?: readonly string[];
  /// El editor se vuelve a montar al cambiar el idioma del menú (su clave lleva la cultura) y pierde lo escrito.
  /// Sólo esas guardas cuentan en `hasUnsavedChanges`: una pantalla que conserva su borrador al cambiar el idioma
  /// no tiene nada que descartar.
  readonly remountsOnLanguageChange?: boolean;
}

const noQueryKeys: readonly string[] = [];

// Las guardas montadas con cambios sin guardar cuyo editor se vuelve a montar con el idioma. Cambiar el idioma del
// menú no pasa por el router: el menú pregunta con `hasUnsavedChanges` antes de cambiarlo.
const dirtyGuards = new Set<object>();
const dirtyGuardListeners = new Set<() => void>();

function subscribeToUnsavedChanges(listener: () => void): () => void {
  dirtyGuardListeners.add(listener);

  return () => {
    dirtyGuardListeners.delete(listener);
  };
}

function updateDirtyGuards(change: () => void): void {
  change();
  for (const listener of dirtyGuardListeners) {
    listener();
  }
}

/// Si alguna pantalla montada perdería cambios sin guardar al cambiar el idioma del menú. La usa el menú del
/// usuario antes de cambiarlo.
export function hasUnsavedChanges(): boolean {
  return dirtyGuards.size > 0;
}

/// `hasUnsavedChanges` como estado: vuelve a renderizar cuando cambia. Con él la sincronización con el idioma de
/// la cuenta espera a que no haya nada que perder.
export function useHasUnsavedChanges(): boolean {
  return useSyncExternalStore(subscribeToUnsavedChanges, hasUnsavedChanges);
}

/// Frena la salida de una pantalla con cambios sin guardar. Las del router (un enlace, las migas, el menú, el
/// Atrás del navegador) las frena `useBlocker` y la pantalla pregunta con su `ConfirmDialog`; recargar o
/// cerrar la pestaña no pasan por el router, así que ahí pregunta el navegador (`useBeforeUnload`).
///
/// Por defecto sólo frena `pathname`; las opciones suman claves de la query y el cambio de idioma del menú.
export function useUnsavedChangesGuard(
  isDirty: boolean,
  { queryKeys = noQueryKeys, remountsOnLanguageChange = false }: UnsavedChangesGuardOptions = {},
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
    if (!isDirty || !remountsOnLanguageChange) {
      return;
    }

    const guard = {};
    updateDirtyGuards(() => dirtyGuards.add(guard));

    return () => {
      updateDirtyGuards(() => dirtyGuards.delete(guard));
    };
  }, [isDirty, remountsOnLanguageChange]);

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
