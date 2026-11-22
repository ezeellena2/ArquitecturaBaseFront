import { numberLocale } from "./numberFormat";

/// ORDENAR POR COLUMNAS (OT1-C, 2026-11-22). El orden vive en la dirección como `sort=campo` o `sort=-campo`, con el nombre
/// del campo del backend, que es el `id` de la columna. El tipo del dato nombra los dos sentidos («De la A a la Z», «De la
/// más reciente a la más antigua») y elige el del primer toque.
export type SortKind = "text" | "number" | "date" | "yesNo" | "state";

export interface ParsedSort {
  field: string;
  descending: boolean;
}

export function parseSort(sort: string | null | undefined): ParsedSort | undefined {
  if (!sort || sort === "-") return undefined;
  return sort.startsWith("-") ? { field: sort.slice(1), descending: true } : { field: sort, descending: false };
}

export function sortValue(field: string, descending: boolean): string {
  return descending ? "-" + field : field;
}

/// El sentido útil del dato, el del primer toque: los números de mayor a menor, las fechas de la más reciente a la más
/// antigua y un sí o no con «Sí» primero; el texto de la A a la Z y un estado en el orden del circuito.
export function startsDescending(kind: SortKind): boolean {
  return kind === "number" || kind === "date" || kind === "yesNo";
}

/// El orden después de tocar una columna: la que ya ordena invierte su sentido; otra empieza en su sentido útil.
/// `current` es el orden que se ve, también el de siempre de la lista cuando es una columna.
export function toggledSort(current: string | null | undefined, field: string, kind: SortKind): string {
  const parsed = parseSort(current);
  return sortValue(field, parsed?.field === field ? !parsed.descending : startsDescending(kind));
}

/// Un valor para ordenar una lista entera en el navegador: un texto, un número (una fecha como su instante, un estado
/// como su lugar en el circuito) o un sí o no. Lo vacío (null, undefined o un texto vacío) va al final en los dos sentidos.
export type SortValue = string | number | boolean | null | undefined;

const collators = new Map<string, Intl.Collator>();

/// Sin mayúsculas ni tildes y con los números por su valor («Lote 2» antes que «Lote 10»), con la región del idioma.
function collator(language: string): Intl.Collator {
  const locale = numberLocale(language);
  let found = collators.get(locale);
  if (!found) collators.set(locale, found = new Intl.Collator(locale, { sensitivity: "base", numeric: true }));
  return found;
}

const isEmpty = (value: SortValue): value is null | undefined | "" => value === null || value === undefined || value === "";

function compare(a: Exclude<SortValue, null | undefined>, b: Exclude<SortValue, null | undefined>, language: string): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return collator(language).compare(String(a), String(b));
}

/// Ordena una lista entera por el `sort` de la dirección, como lo haría la base: lo vacío al final en los dos sentidos y,
/// con el mismo valor, el orden en que llegó. Un campo sin valor en `values` deja la lista como está.
export function sortRows<TRow>(rows: readonly TRow[], sort: string | null | undefined, values: Readonly<Record<string, (row: TRow) => SortValue>>, language: string): readonly TRow[] {
  const parsed = parseSort(sort);
  const value = parsed ? values[parsed.field] : undefined;
  if (!parsed || !value) return rows;
  return rows.map((row, index) => ({ row, index, value: value(row) })).sort((a, b) => {
    if (isEmpty(a.value) || isEmpty(b.value)) return isEmpty(a.value) === isEmpty(b.value) ? a.index - b.index : isEmpty(a.value) ? 1 : -1;
    const order = compare(a.value, b.value, language);
    return (parsed.descending ? -order : order) || a.index - b.index;
  }).map(entry => entry.row);
}
