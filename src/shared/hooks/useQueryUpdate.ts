import { useCallback } from "react";
import { useSearchParams } from "react-router";

/// Escribe en la query string. `undefined` y `""` borran el parámetro en vez de escribirlo vacío: un valor
/// por omisión no va en la URL, así el enlace que se comparte dice solo lo que se eligió.
///
/// Va con `replace: true` para no llenar el historial: escribiendo en el buscador, cada tecla sería una
/// entrada y el botón atrás tardaría veinte clics en salir del listado.
///
/// Vive aparte porque lo usan `usePagination` y `useFilters`, y la query string es una sola.
///
/// **Dos llamadas en el mismo tick no se acumulan.** `previous` es la query string ya confirmada, no la que
/// dejó pendiente la llamada anterior, así que la segunda pisa a la primera. Está comprobado, no supuesto.
/// Por eso todo lo que tiene que viajar junto va en **una sola** llamada: `setFilter` manda el filtro y el
/// `page: undefined` en el mismo objeto, y `clear` manda todas las claves de una.
export function useQueryUpdate() {
  const [, setParams] = useSearchParams();

  return useCallback(
    (changes: Record<string, string | undefined>) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);

          for (const [key, value] of Object.entries(changes)) {
            if (value === undefined || value === "") {
              next.delete(key);
            } else {
              next.set(key, value);
            }
          }

          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );
}
