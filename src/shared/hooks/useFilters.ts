import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import { useQueryUpdate } from "./useQueryUpdate";

export interface Filters<K extends string> {
  /// El valor de cada filtro, o `undefined` si no está puesto. Son cadenas porque vienen de la URL: quien
  /// necesite un booleano o un número lo convierte, que es el único lugar donde se sabe qué significa.
  readonly values: Readonly<Record<K, string | undefined>>;
  /// Los que están puestos, en el orden en que se declararon. Es lo que cuentan los chips y el contador.
  readonly active: readonly K[];
  readonly setFilter: (key: K, value: string | undefined) => void;
  /// Saca los filtros y la búsqueda, y deja el orden: el orden no cambia qué filas hay, solo en qué orden.
  readonly clear: () => void;
}

/// Los filtros de un listado viven en la URL, igual que la página y la búsqueda (`usePagination`): así el
/// listado filtrado se puede compartir y el botón atrás funciona.
///
/// Cambiar un filtro vuelve a la página 1 por el mismo camino que ya usa el cambio de búsqueda. Sin eso, se
/// puede quedar parada en una página que con el filtro nuevo ya no existe, y el listado se ve vacío por un
/// motivo que no tiene nada que ver con lo que se filtró.
export function useFilters<K extends string>(keys: readonly K[]): Filters<K> {
  const [params] = useSearchParams();
  const update = useQueryUpdate();

  // `params.toString()` en las dependencias y no `params`: es un objeto nuevo en cada render, así que el memo
  // no serviría de nada.
  const search = params.toString();

  const values = useMemo(
    () =>
      Object.fromEntries(
        keys.map((key) => [key, new URLSearchParams(search).get(key) ?? undefined]),
      ) as Record<K, string | undefined>,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `keys` es una constante del módulo que lo usa.
    [search],
  );

  const active = useMemo(() => keys.filter((key) => values[key] !== undefined), [keys, values]);

  const setFilter = useCallback(
    (key: K, value: string | undefined) => update({ [key]: value, page: undefined }),
    [update],
  );

  const clear = useCallback(
    () => update({ ...Object.fromEntries(keys.map((key) => [key, undefined])), search: undefined, page: undefined }),
    [keys, update],
  );

  return useMemo(() => ({ values, active, setFilter, clear }), [values, active, setFilter, clear]);
}
