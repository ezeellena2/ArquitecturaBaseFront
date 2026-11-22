import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { sortRows, type SortValue } from "@/shared/lib/sort";

/// Una tabla que llega entera ordena en el navegador con la misma regla que la base (OT1-C, 2026-11-22): por el `sort` de
/// la dirección, con el idioma del menú, lo vacío al final y, con el mismo valor, el orden en que llegó. `values` dice qué
/// valor ordena cada columna, por su `id`; conviene que no cambie en cada render (fuera del componente o con `useMemo`).
/// `defaultSort` es el orden de siempre de la lista cuando es una columna.
export function useClientSort<TRow>(rows: readonly TRow[], values: Readonly<Record<string, (row: TRow) => SortValue>>, defaultSort?: string): readonly TRow[] {
  const [params] = useSearchParams();
  const { i18n } = useTranslation();
  const sort = params.get("sort") ?? defaultSort;
  return useMemo(() => sortRows(rows, sort, values, i18n.language), [rows, sort, values, i18n.language]);
}
